import path from 'path';
import express from 'express';
import log4js from 'log4js';
import type http from "http";
import type { Config } from './types.js';
import type { Registry } from 'prom-client';


export class Web {
    private _webserver: http.Server;
    private logger: log4js.Logger;

    constructor(conf: Config, register: Registry) {
        this.logger = log4js.getLogger(path.basename(import.meta.filename));
        this.logger.level = conf.loglevel;
        const app = express();
        if (!conf.webport) {
            throw new Error('can\'t start a web server without a port.');
        }
        const port = conf.webport;
        app.set('trust proxy', 1);

        app.get('/healthcheck', async (_, res) => {
            res.send('Healthy');
        });

        app.get('/metrics', async (_, res) => {
            try {
                res.set('Content-Type', register.contentType);
                res.end(await register.metrics());
            }
            catch (ex) {
                this.logger.error('error sending metrics: %s', ex);
                res.status(500).send('something went wrong.');
            }
        });

        this._webserver = app.listen(port, () => this.logger.info('Web server running on %d', port));
    }

    close() {
        this._webserver.close();
    }

}