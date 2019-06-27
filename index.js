const Discord = require('discord.js');
const randomWord = require('random-word');
const config = require("./botconfig.json");
const hangman = require("./hangman.js");

const client = new Discord.Client();
const prefix = "hang"

const runningGames = new Set();

function gatherPlayers(channel) {
    return new Promise((resolve, reject) => {
        let players = [];
        const filter = (msg) => (msg.content.toLowerCase().includes("join") && !msg.author.bot);
        const collector = channel.createMessageCollector(filter, { time: 10000 });
        collector.on('collect', msg => {
            players.push(msg.author);
            msg.delete();
        });
        collector.on('end', async (collected) => {
            resolve(players);
        });
    });
}

async function getNextMessage(channel, maxTime) {
    return await channel.awaitMessages((m) => !m.author.bot, { max: 1, time: maxTime, errors: ['time'] })
        .catch((collected) => { throw collected });
}

async function getWordFromPlayers(players, channel) {
    let word;
    let chosenOne;
    while (!word && players.length > 1) {
        let index = Math.floor((Math.random() * 1000) % players.length);
        chosenOne = players[index];
        players.splice(index, 1);

        const dm = await chosenOne.createDM();

        await dm.send("You are the chosen one!! Just write the word of your choice. You have 30 seconds. And remember, you can't participate in the game");
        let finish = false;
        let tries = 0;
        let msgCollection;
        while (!finish && tries < 3) {
            try {
                msgCollection = await getNextMessage(dm, 30000);
            } catch (collected) {
                await dm.send("Time's up sorry, you are disqualified.");
                await channel.send("The chosen one didn't answser... selecting ANOTHER ONE");
                finish = true;
                continue;
            }

            const msg = msgCollection.first().content;
            if (msg.match(/^[A-Za-zÀ-ú]{3,}$/)) {
                word = msg.toLowerCase();
                finish = true;
            } else {
                await dm.send("Thats not a valid word. No spaces, at least 3 characters.");
                ++tries;
                if (tries == 3) {
                    await dm.send("Sorry, too many invalid words, try again next game. You are disqualified.");
                }
            }
        }
    }

    if (!word && players.length <= 1) {
        channel.send("We ran out of players... try again, I'm sure you can do it better.");
        return;
    }

    return { word: word, selector: chosenOne }
}

async function showProgress(channel, game, gameMessage) {
    if (gameMessage) {
        await gameMessage.edit(`${game.progress} | Lives: ${game.lives} | Status: ${game.status}`);
    } else {
        return await channel.send(`${game.progress} | Lives: ${game.lives} | Status: ${game.status}`);
    }
}

async function startGame(channel, gameType) {
    await channel.send("Write \"join\" to participate in this game! You have 10 seconds.");
    const players = await gatherPlayers(channel);
    await channel.send("Aaand STOP! " + players.length + " users have joined the game.");
    if (players.length == 0) {
        channel.send("Maybe in another moment... no one joined the game");
        return;
    }
    if (gameType === "custom" && players.length < 2) {
        channel.send("For a custom word game, there has to be at least 2 players...");
        return;
    }

    let word;
    let selector;
    switch (gameType) {
        case "random":
            // get a random word;
            word = randomWord();
            break;
        case "custom":
            await channel.send("Selecting a player to choose the word. Waiting for one of you to respond. Check your DMs!!");
            let userSelection = await getWordFromPlayers(players, channel);
            if (userSelection) {
                word = userSelection.word;
                selector = userSelection.selector;
            } else {
                return;
            }
            break;
    }

    const game = new hangman(word);

    return { game, players, selector };
}

async function runGame(channel, game, players) {
    await channel.send("All ready, starting the game!");
    const gameMessage = await showProgress(channel, game);
    const filter = ((m) => {
        const a = players.find((p) => (p.id == m.author.id));
        const b = m.content.match(/^[A-Za-zÀ-ú]{1}$/);
        return (a && b && b.length == 1);
    });

    const collector = channel.createMessageCollector(filter, { time: 900000 }); // max of 15 minutes per game

    return new Promise((resolve, reject) => {
        collector.on('collect', async (m) => {
            const c = m.content.toLowerCase();
            m.delete();
            game.guess(c);
            await showProgress(channel, game, gameMessage);
            if (game.status !== "in progress") {
                collector.stop();
            }
        });
        collector.on('end', async (collected) => {
            await channel.send("Game has ended.");
            resolve("game finished");
        });
    });
}

async function showResult(channel, game, selector) {
    if (game.status === "won") {
        if (selector) {
            channel.send(`You won!! You guessed the word. ${selector.username}... you need to suggest a more difficult word next time`);
        } else {
            channel.send("You win this time...");
        }
    } else if (game.status === "lost") {
        if (selector) {
            channel.send(`${selector.username} has won all of you!!. Try harder nest time. The word was ${game.word}.`);
        } else {
            channel.send(`I win!! Machines will rise and will kill all the wumpuses. The word was ${game.word}.`);
        }
    } else {
        channel.send("The game ended, the 15 minutes time limit was reached.");
    }
}

client.on('message', async (msg) => {
    if (!msg.author.bot && msg.content.startsWith(prefix) && msg.channel.type === "text") {
        const args = msg.content.slice(prefix.length).trim().split(' ').filter(word => word.trim().length > 0);
        switch (args[0]) {
            case "start":
                if (!runningGames.has(msg.guild)) {
                    let gameType = "random";
                    if (args[1]) switch (args[1]) {
                        case "random":
                            gameType = "random";
                            break;
                        case "custom":
                            gameType = "custom";
                            break;
                        default:
                            msg.reply("Games can be \"custom\" or \"random\"");
                            return;
                    }

                    runningGames.add(msg.channel.guild);

                    let game, players, selector;
                    const gameInfo = await startGame(msg.channel, gameType);
                    if (gameInfo) {
                        game = gameInfo.game;
                        players = gameInfo.players;
                        selector = gameInfo.selector;
                        await runGame(msg.channel, game, players);
                        await showResult(msg.channel, game, selector);
                    }

                    runningGames.delete(msg.channel.guild);
                } else {
                    msg.reply("There's already a game running on this server.");
                }
                break;
            case "help":
                msg.channel.sendEmbed(helpEmbed);
                break;
        }
    }
});

client.on('ready', () => {
    client.user.setActivity(prefix + " help");

});

client.on('error', (err) => console.error(err));

client.login(config.token).then((token) => console.log("Logged in successfully as " + client.user.tag)).catch(console.error);