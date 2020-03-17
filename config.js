const fs = require('fs');

class Config {
    constructor(defaultCfg) {
        this._config = {};
        let cfg = defaultCfg;

        for(let i = 0; i < process.argv.length; i++){
            if((process.argv[i] === '--config' || process.argv[i] === '-c') && i + 1 < process.argv.length){
                cfg = process.argv[++i];
            }
        }

        try{
            this._config = JSON.parse(fs.readFileSync(defaultCfg));
        }
        catch(e){
            console.log(`Couldn't read config: ${e}`);
        }
    }

    get(option, fallback = undefined){
        return (option in this._config) ? this._config[option] : fallback;
    }
}

module.exports = exports = Config;