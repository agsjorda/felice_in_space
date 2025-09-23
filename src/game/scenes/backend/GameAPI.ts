import { Events } from "../components/Events";
import { GameData } from "../components/GameData";
import chalk from 'chalk';

/**
 * Function to parse URL query parameters
 * @param name - The name of the parameter to retrieve
 * @returns The value of the parameter or null if not found
 */
function getUrlParameter(name: string): string {
    const urlParams = new URLSearchParams(window.location.search);
    let str : string = '';
    if(urlParams.get('start_game')){
        str = 'start_game';
    }
    else{
        str = urlParams.get(name) || '';
    }
    return str;
}

/**
 * Function to log all URL parameters for debugging
 * Only logs if there are any parameters present
 */
function logUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.toString()) {
        console.log('🔍 URL Parameters:', Object.fromEntries(urlParams.entries()));
    }
}


const getApiBaseUrl = (): string => {
    const configuredUrl = (window as any)?.APP_CONFIG?.['game-url'];
    if (typeof configuredUrl === 'string' && configuredUrl.length > 0) {
        return configuredUrl.replace(/\/$/, "");
    }
    return 'https://game-launcher.torrospins.com/'; // 192.168.0.17:3000/

};

export class GameAPI {  
    gameData: GameData;
    exitURL: string = '';
    constructor(gameData: GameData) {
        this.gameData = gameData;
    }   

    private async generateGameUrlToken(): Promise<{url: string, token: string}> {
        const apiUrl = `${getApiBaseUrl()}/api/v1/generate_url`;
        
        const requestBody = {
            "operator_id": "1",
            "player_id": 2,
            "game_id": "00030525",
            "device": "desktop",
            "lang": "en",
            "currency": "",
            "quit_link": "www.quit.com",
            "free_spin": "1",
            "session": "83f78be3-8685-4142-aa4e-7b1a4d0a7415",
            "player_name": "test"
        };

        const headers = {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Accept-Encoding': 'gzip, deflate, br',
            'x-access-token': 'taVHVt4xD8NLwvlo3TgExmiSaGOiuiKAeGB9Qwla6XKpmSRMUwy2pZuuYJYNqFLr',
            'x-brand': '6194bf3a-b863-4302-b691-9cc8fe9b56c8'
        };

        try {
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            //console.log('Response status:', response.status);
            //console.log('Response ok:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                //console.error('Response error text:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            
            return {
                url: data.data.url,
                token: data.data.token 
            };
        } catch (error) {
            //console.error('Error generating game URL:', error);
            throw error;
        }
    }

    public async gameLauncher(): Promise<void> {
        try {
            localStorage.removeItem('gameToken');
            localStorage.removeItem('exit_url');
            localStorage.removeItem('what_device');

            sessionStorage.removeItem('gameToken');
            sessionStorage.removeItem('exit_url');
            sessionStorage.removeItem('what_device');
            
            console.log(chalk.yellowBright.bold('Starting gameLauncher...'));
            //let {url, token} = await this.generateGameUrlToken();
            let token1 = '';
            let tokenParam = getUrlParameter('token');
            if(tokenParam){
                token1 = tokenParam;
                localStorage.setItem('gameToken', token1);
                sessionStorage.setItem('gameToken', token1);
            }

            let deviceUrl = getUrlParameter('device');
            if(deviceUrl){
                localStorage.setItem('what_device',deviceUrl);
                sessionStorage.setItem('what_device',deviceUrl);
            }

            let apiUrl = getUrlParameter('api_exit');
            if(apiUrl){
                this.exitURL = apiUrl;
                localStorage.setItem('exit_url',apiUrl);
                sessionStorage.setItem('exit_url',apiUrl);
            }

            let startGame = getUrlParameter('start_game');
            if(startGame){
                console.log('startGame');
                let {url, token} = await this.generateGameUrlToken();
                token1 = token;
                localStorage.setItem('gameToken', token);
                sessionStorage.setItem('gameToken', token);
            }

            //console.log(chalk.magenta.bold('generateGameUrl response:'), {token});
            //console.log('URL type:', typeof url, 'Token type:', typeof token);
            if (!token1 && !startGame) {
                throw new Error();
            }
        } catch (error) {
            throw new Error();
        }
    }
    public async getBalance(): Promise<any> {
        try{
            const response = await fetch(`${getApiBaseUrl()}/api/v1/slots/balance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('gameToken')}`
                },
                //body: JSON.stringify({
                    //action: 'get_balance',
                //})
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            //console.log('getbalance', data);
            return data;
        } catch (error) {
            this.gameData.debugError('Error in getBalance:', error);
            throw error;
        }
    }

    public async doSpin(bet: number, isBuyFs:boolean, isEnhancedBet:boolean): Promise<any> {
        let _isBuyFs : string = isBuyFs? chalk.green('true') : chalk.red('false');
        let _isEnBet : string = isEnhancedBet? chalk.green('true') : chalk.red('false');
        console.log(
            chalk.grey('[API] doSpin called. bet: ') + chalk.blue(bet) + 
        chalk.grey(' | isBuyFs: ') + _isBuyFs + 
        chalk.grey(' | isEnhancedBet: ') + _isEnBet);
        if(!localStorage.getItem('gameToken')){
            return "error";
        }
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/v1/slots/bet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('gameToken')}`
                    //'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXNzaW9uIjoiZWZiNzlmNWMyZTVjZTk1MmM3OTg3YWUwYjBjZTU4ZjQ6MDUyMDA5NmIxNDVmNTExYzUwOTdlZDBhZmEzMTNmOGMiLCJjdXJyZW5jeSI6IlVTRCIsImxhbmciOiJlbiIsInBsYXllcl9pZCI6IjIiLCJvcGVyYXRvcl9pZCI6IjE4YjAzNzE3LTMzYTctNDZkNi05YzcwLWFjZWU4MGM1NGQwMyIsImdhbWVfbmFtZSI6IlN1Z2FyV29uZGVybGFuZCIsImlhdCI6MTc1NTUwMDM0NywiZXhwIjoxNzU1NTAzOTQ3fQ.PyitkzXtRFSpiasNkQO9OW-twSDPnJoE26_GMIadQm4`
                },
                body: JSON.stringify({
                    action: 'spin',
                    bet: bet.toString(),
                    line: 2,
                    isBuyFs: isBuyFs,
                    isEnhancedBet: isEnhancedBet
                })
            });

            if(response.status === 401){
                try { Events.emitter.emit(Events.SESSION_TIMEOUT, {}); } catch (_e) {}
                throw new Error(`HTTP error! status: ${response.status}`);
            }

           
            // Treat HTTP 400 as session timeout
            if(response.status === 400){
                try { Events.emitter.emit(Events.SESSION_TIMEOUT, {}); } catch (_e) {}
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data && data.statusCode === 400 || data.statusCode === 401) {
                try { Events.emitter.emit(Events.SESSION_TIMEOUT, {}); } catch (_e) {}
                throw new Error(`HTTP error! status: ${data.statusCode}`);
            }
            console.log(chalk.gray('[API] doSpin response data:'), data);
            return data;

        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    public async getHistory(page: number, limit: number): Promise<any> {
        const apiUrl = `${getApiBaseUrl()}/api/v1/games/me/histories`;
        
        const response = await fetch(`${apiUrl}?limit=${limit}&page=${page}`,{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('gameToken')}`
            }
        });
        
        const data = await response.json();
        if(data.statusCode === 401){
            try { Events.emitter.emit(Events.SESSION_TIMEOUT, {}); } catch (_e) {}
            throw new Error(`HTTP error! status: ${data.statusCode}`);
        }
        return data;
    }
}   