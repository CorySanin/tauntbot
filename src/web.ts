import express from 'express';
import type http from "http";
import type { Config } from './types.js';
import type { Registry } from 'prom-client';


export class Web {
    private _webserver: http.Server;

    constructor(conf: Config, register: Registry) {
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
                console.error(ex);
                res.status(500).send('something went wrong.');
            }
        });

        this._webserver = app.listen(port, () => console.log(`Web server running on ${port}`));
    }

    close() {
        this._webserver.close();
    }

}