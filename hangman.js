String.prototype.replaceAt = function(index, replacement) {
    return this.substr(0, index) + replacement+ this.substr(index + replacement.length);
}

class hangman {
    constructor(word) {
        this.word = word;
        this.lives = 6;
        this.progress = hangman.hyphenString(word.length);
        this.remaining = word.length;
        this.misses = [];
        this.status = "in progress";
    }

    static hyphenString(n) {
        let str = "";
        for (let i = 0; i < n; ++i) {
            str += "-";
        }
        return str;
    }

    guess(c) {
        if (this.progress.includes(c)) {
            --this.lives;
        } else if (this.word.includes(c)) {
            for (let i = 0; i < this.word.length; ++i) {
                if (this.word[i] === c) {
                    this.progress = this.progress.replaceAt(i, this.word[i]);
                    --this.remaining;
                }
            }
        } else {
            if (!this.misses.includes(c)) {
                this.misses.push(c);
            }
            --this.lives;
        }

        if (this.lives == 0) {
            this.status = "lost";
        } else if (this.remaining == 0) {
            this.status = "won";
        }
        return { status: this.status, progress: this.progress, misses: this.misses, lifes: this.lives };
    }

    guessAll(word) {
        if (this.word === word) {
            this.progress = this.word;
            this.status = "won";
        } else {
            --this.lives;
        }
        return this.status === "won";
    }
}

module.exports = hangman;