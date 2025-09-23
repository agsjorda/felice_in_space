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
        return {
            data:
            {
                balance: 10000
            }
        }
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

            if (this.gameData.debugged < -99) {
                if(this.gameData.debugged == -100){ // 123456789.01 win = wtf ; fake API
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0]],"totalWin":123456789.01,"tumbles":[],"freeSpin":[{"spinsLeft":10,"area":[[9,4,4,9,2],[8,8,2,0,7],[4,9,6,6,4],[8,8,8,8,0],[13,6,8,8,9],[2,8,8,3,9]],"totalWin":0,"multipliers":[],"tumbles":[{"symbols":{"in":[[],[7,1],[],[6,6,7,1],[13,6],[4,4]],"out":[{"symbol":8,"count":10,"win":9}]},"win":9}]},{"spinsLeft":14,"area":[[5,6,7,8,0],[5,6,7,8,0],[5,6,7,8,0],[9,9,9,9,0],[9,2,9,1,0],[5,6,7,8,0]],"totalWin":225,"multipliers":[13,13],"tumbles":[]},{"spinsLeft":8,"area":[[9,8,9,6,6],[5,6,8,8,7],[9,6,6,4,7],[6,3,3,6,6],[7,9,9,3,3],[5,5,7,6,6]],"totalWin":12,"multipliers":[],"tumbles":[{"symbols":{"in":[[5,5],[8],[2,6],[7,9,9],[],[7,7]],"out":[{"symbol":6,"count":10,"win":12}]},"win":12}]},{"spinsLeft":7,"area":[[7,7,7,8,8],[7,9,9,9,3],[3,3,14,1,6],[8,8,8,5,9],[9,6,6,5,5],[6,1,9,5,5]],"totalWin":0,"multipliers":[14],"tumbles":[]},{"spinsLeft":6,"area":[[8,3,4,9,4],[3,7,5,5,8],[6,2,8,8,5],[5,7,7,9,9],[9,9,8,8,4],[6,6,4,4,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":5,"area":[[9,5,7,6,8],[7,5,5,8,8],[9,6,6,4,7],[8,8,5,9,6],[5,2,9,6,6],[7,8,8,9,15]],"totalWin":0,"multipliers":[15],"tumbles":[]},{"spinsLeft":4,"area":[[5,7,6,8,8],[5,5,8,8,2],[5,5,7,7,8],[3,6,6,6,9],[3,3,6,1,9],[9,8,8,6,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":3,"area":[[7,8,8,7,4],[3,9,5,5,7],[8,5,5,7,7],[3,3,6,3,3],[9,6,6,7,6],[5,7,6,2,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":2,"area":[[9,8,9,6,6],[7,9,5,5,6],[4,7,7,7,5],[1,3,3,6,3],[8,9,7,7,9],[3,9,9,5,5]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":1,"area":[[8,7,4,7,7],[6,6,9,9,4],[8,9,7,7,9],[5,5,8,8,2],[5,2,9,6,6],[6,7,7,7,9]],"totalWin":5,"multipliers":[],"tumbles":[{"symbols":{"in":[[7,5,5],[],[5,5],[],[],[8,8,9]],"out":[{"symbol":7,"count":8,"win":5}]},"win":5}]}]}};
                    return data;
                }
                else if (this.gameData.debugged == -101){ // 20 free spins
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[1,4,0,2,3],[8,6,5,7,0],[1,2,9,3,9],[1,3,9,4,2],[8,0,6,5,7],[2,1,3,9,0]],"totalWin":397,"tumbles":[],"freeSpin":[{"spinsLeft":10,"area":[[5,7,6,8,8],[8,9,6,4,6],[7,8,8,9,3],[1,3,3,6,3],[7,9,9,3,3],[9,9,8,8,6]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":9,"area":[[9,6,6,7,7],[2,0,7,7,9],[9,6,9,7,5],[9,6,5,5,8],[9,7,7,9,9],[6,5,7,6,2]],"totalWin":22.5,"multipliers":[11],"tumbles":[{"symbols":{"in":[[7,11,9],[4,4,9],[8,8,7],[7],[8,8,9,9,4],[4]],"out":[{"symbol":9,"count":8,"win":2.5},{"symbol":7,"count":8,"win":5}]},"win":7.5}]},{"spinsLeft":8,"area":[[7,7,7,8,8],[9,9,5,4,4],[6,2,8,8,5],[2,5,4,6,12],[6,1,9,7,9],[9,9,6,6,1]],"totalWin":0,"multipliers":[12],"tumbles":[]},{"spinsLeft":7,"area":[[8,9,7,9,8],[9,9,5,4,4],[5,5,7,7,7],[4,6,12,9,2],[9,5,5,8,8],[4,4,4,3,3]],"totalWin":0,"multipliers":[12],"tumbles":[]},{"spinsLeft":6,"area":[[5,7,7,6,6],[8,7,7,9,9],[8,9,9,6,9],[8,8,7,5,5],[6,6,7,6,8],[6,6,4,4,9]],"totalWin":122.5,"multipliers":[13],"tumbles":[{"symbols":{"in":[[5,9],[],[5],[],[9,0,7],[8,8]],"out":[{"symbol":6,"count":8,"win":8}]},"win":8},{"symbols":{"in":[[7],[4,5],[7,6,9],[],[3],[5]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5},{"symbols":{"in":[[4,8,8],[3,9],[8],[2],[0,7],[]],"out":[{"symbol":7,"count":9,"win":5}]},"win":5},{"symbols":{"in":[[3,8],[9],[4,2],[6,6],[13],[7,7]],"out":[{"symbol":8,"count":10,"win":9}]},"win":9}]},{"spinsLeft":5,"area":[[7,7,9,9,8],[4,6,9,9,8],[9,6,7,6,3],[9,8,8,7,5],[4,4,9,9,5],[4,3,3,9,9]],"totalWin":7.5,"multipliers":[],"tumbles":[{"symbols":{"in":[[8,5],[9,9],[7],[6],[4,8],[5,9]],"out":[{"symbol":9,"count":10,"win":7.5}]},"win":7.5}]},{"spinsLeft":4,"area":[[2,7,8,8,8],[0,7,7,9,9],[14,1,6,2,8],[6,3,3,6,6],[5,4,7,7,7],[8,8,9,15,7]],"totalWin":0,"multipliers":[14,15],"tumbles":[]},{"spinsLeft":3,"area":[[9,5,7,6,8],[7,8,8,9,6],[7,7,5,5,8],[5,5,8,8,2],[7,9,9,5,5],[8,8,6,5,7]],"totalWin":33.5,"multipliers":[],"tumbles":[{"symbols":{"in":[[9,8],[1,4],[6,6,9],[8,0,7,9],[8,7],[8,8,9]],"out":[{"symbol":5,"count":8,"win":10},{"symbol":8,"count":8,"win":4}]},"win":14},{"symbols":{"in":[[9,6,6],[5,7],[9,5,5],[5,5],[9,8,8,6],[6,9]],"out":[{"symbol":9,"count":8,"win":2.5},{"symbol":7,"count":8,"win":5}]},"win":7.5},{"symbols":{"in":[[8,2,6],[8],[4,4],[],[3],[6,9]],"out":[{"symbol":6,"count":9,"win":8}]},"win":8},{"symbols":{"in":[[8,7],[8],[],[6],[5,6,6],[7,5]],"out":[{"symbol":8,"count":9,"win":4}]},"win":4}]},{"spinsLeft":2,"area":[[1,3,3,9,5],[0,7,7,9,9],[5,5,8,8,9],[8,2,5,4,6],[4,9,9,5,5],[9,8,8,6,9]],"totalWin":2.5,"multipliers":[],"tumbles":[{"symbols":{"in":[[2],[9,7],[0],[],[9,0],[6,7]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5}]},{"spinsLeft":6,"area":[[8,9,11,7,7],[2,0,7,7,9],[8,5,5,7,7],[9,9,1,3,3],[3,3,6,1,9],[7,8,8,9,15]],"totalWin":0,"multipliers":[11,15],"tumbles":[]},{"spinsLeft":5,"area":[[3,3,9,5,5],[9,8,8,9,4],[9,6,7,6,3],[8,7,5,5,7],[8,4,4,9,9],[5,7,6,6,4]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":4,"area":[[5,8,8,9,11],[9,9,8,8,9],[8,8,5,5,7],[8,5,9,6,5],[6,7,6,8,8],[8,4,4,4,3]],"totalWin":34.5,"multipliers":[11],"tumbles":[{"symbols":{"in":[[8,8],[9,9],[9,7],[6],[7,7],[6]],"out":[{"symbol":8,"count":10,"win":9}]},"win":9},{"symbols":{"in":[[8],[4,9,9,6,6],[5],[8],[],[]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5}]},{"spinsLeft":3,"area":[[8,9,11,7,7],[7,9,5,5,6],[8,9,7,7,9],[9,8,5,5,6],[5,5,8,8,9],[9,6,6,1,9]],"totalWin":7.5,"multipliers":[11],"tumbles":[{"symbols":{"in":[[8],[1],[6,9],[4],[9],[4,4]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5}]},{"spinsLeft":2,"area":[[11,7,7,9,9],[6,6,9,9,4],[7,7,9,9,0],[9,9,7,0,8],[8,8,6,6,13],[7,7,8,8,9]],"totalWin":60,"multipliers":[11,13],"tumbles":[{"symbols":{"in":[[3,3],[0,2],[7,7],[5,8],[],[8]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5},{"symbols":{"in":[[5,9],[],[4,4,2,0],[3],[],[1,6]],"out":[{"symbol":7,"count":9,"win":5}]},"win":5}]},{"spinsLeft":6,"area":[[8,7,4,7,7],[6,8,8,7,7],[4,9,9,7,8],[8,9,4,4,9],[3,7,0,9,4],[4,4,3,3,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":5,"area":[[7,6,8,8,9],[5,5,6,8,8],[7,5,5,9,6],[8,8,7,5,5],[6,8,8,6,6],[9,6,6,4,4]],"totalWin":87,"multipliers":[14],"tumbles":[{"symbols":{"in":[[4,4,9],[6,6,6],[8],[9,7],[9,9,4,4,9],[8,8]],"out":[{"symbol":8,"count":8,"win":4},{"symbol":6,"count":8,"win":8}]},"win":12},{"symbols":{"in":[[8,8],[],[14],[4],[5,6,6],[7]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5}]},{"spinsLeft":4,"area":[[9,2,7,8,8],[6,6,6,9,9],[5,8,8,9,7],[6,12,9,2,4],[6,6,7,6,8],[5,7,7,8,8]],"totalWin":0,"multipliers":[12],"tumbles":[]},{"spinsLeft":3,"area":[[8,8,9,11,7],[8,8,2,0,7],[3,3,3,14,1],[6,12,9,2,4],[3,7,0,9,4],[9,15,7,9,6]],"totalWin":0,"multipliers":[12,15,11,14],"tumbles":[]},{"spinsLeft":2,"area":[[5,8,8,9,11],[8,8,9,4,7],[7,7,5,5,8],[3,3,6,3,3],[5,8,8,9,7],[7,7,8,8,9]],"totalWin":19.5,"multipliers":[11],"tumbles":[{"symbols":{"in":[[9,4],[8,8],[9],[],[9,8],[9,7]],"out":[{"symbol":8,"count":9,"win":4}]},"win":4},{"symbols":{"in":[[8,5],[4],[6],[],[2,1],[6,6]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5}]},{"spinsLeft":1,"area":[[9,5,7,6,8],[7,5,5,8,8],[2,4,4,9,6],[0,8,9,4,4],[7,9,9,5,5],[8,8,6,9,6]],"totalWin":0,"multipliers":[],"tumbles":[]}]}};
                    return data;
                }
                else if (this.gameData.debugged == -102){ // 10 spins, normal game., tumble then multiplier x2, 
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[4,1,0,3,2],[0,8,5,7,6],[9,1,2,9,3],[1,2,3,9,4],[5,6,7,0,8],[2,9,1,0,3]],"totalWin":159.5,"tumbles":[],"freeSpin":[{"spinsLeft":10,"area":[[11,7,7,9,9],[1,3,10,3,9],[8,8,9,7,7],[6,6,9,9,8],[2,3,7,0,9],[7,9,9,8,8]],"totalWin":97.5,"multipliers":[10,11],"tumbles":[{"symbols":{"in":[[7,7],[3],[6],[6,6],[6],[6,6]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5},{"symbols":{"in":[[8,8,6,7],[],[8,3,6],[4,5,2,8],[2,5],[2,6,4]],"out":[{"symbol":7,"count":8,"win":5},{"symbol":6,"count":8,"win":8}]},"win":13},{"symbols":{"in":[[7,9],[],[9,8,8],[8,9],[],[3,4]],"out":[{"symbol":8,"count":9,"win":4}]},"win":4}]},{"spinsLeft":9,"area":[[7,6,8,8,9],[9,1,8,8,2],[6,7,6,3,8],[7,7,9,9,7],[8,8,6,6,13],[7,6,2,9,9]],"totalWin":0,"multipliers":[13],"tumbles":[]},{"spinsLeft":8,"area":[[9,11,7,7,9],[9,4,4,1,3],[6,7,6,3,8],[3,3,6,3,3],[8,4,4,9,9],[6,2,8,8,3]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":7,"area":[[5,7,6,8,8],[7,9,9,9,3],[9,6,9,7,5],[4,9,9,8,5],[8,9,5,2,9],[6,7,7,7,9]],"totalWin":43,"multipliers":[10],"tumbles":[{"symbols":{"in":[[],[8,5,5],[8,8],[8,5],[4,8],[9]],"out":[{"symbol":9,"count":10,"win":7.5}]},"win":7.5},{"symbols":{"in":[[8,8],[9],[9,5],[9,9],[8,6],[]],"out":[{"symbol":8,"count":9,"win":4}]},"win":4},{"symbols":{"in":[[7],[3,10],[2,6],[6,6],[0],[]],"out":[{"symbol":5,"count":8,"win":10}]},"win":10}]},{"spinsLeft":6,"area":[[8,9,11,7,7],[0,7,7,9,9],[9,0,2,4,4],[8,5,5,6,6],[9,9,5,5,4],[8,8,4,4,4]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":5,"area":[[7,7,7,6,2],[8,2,6,6,6],[7,8,8,9,3],[8,2,5,4,6],[5,5,4,7,7],[7,6,2,9,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":4,"area":[[8,8,3,4,9],[8,8,9,4,7],[4,4,9,9,7],[4,7,6,6,6],[5,5,4,7,7],[8,9,15,7,9]],"totalWin":0,"multipliers":[15],"tumbles":[]},{"spinsLeft":3,"area":[[4,1,3,3,9],[9,8,8,9,4],[9,9,0,2,4],[6,6,9,9,9],[7,7,7,8,8],[7,7,8,8,9]],"totalWin":6.5,"multipliers":[],"tumbles":[{"symbols":{"in":[[2],[8,8],[9,5],[4,4,9],[],[4]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5},{"symbols":{"in":[[],[0,2,8,8],[],[],[7,9],[9,9]],"out":[{"symbol":8,"count":8,"win":4}]},"win":4}]},{"spinsLeft":2,"area":[[5,7,6,8,8],[9,1,8,8,2],[5,7,7,7,9],[8,8,7,5,5],[3,3,6,1,9],[6,6,4,4,4]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":1,"area":[[3,4,9,4,4],[9,5,5,7,7],[6,4,4,9,9],[9,9,9,8,8],[8,6,6,13,6],[9,8,8,6,9]],"totalWin":12.5,"multipliers":[13],"tumbles":[{"symbols":{"in":[[2],[6],[8,2],[6,4,5],[],[5,5]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5}]}]}};
                    return data;
                }
                else if (this.gameData.debugged == -103){ // 10 spins 6.5k 100x bomb
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[2,4,1,3,0],[5,8,7,6,0],[2,1,9,3,9],[2,4,9,3,1],[8,7,5,6,0],[1,2,9,0,3]],"totalWin":6600,"tumbles":[],"freeSpin":[{"spinsLeft":10,"area":[[8,8,3,10,4],[9,3,11,7,5],[6,4,7,7,7],[9,9,8,8,13],[7,6,8,8,6],[9,6,6,1,9]],"totalWin":0,"multipliers":[11,10,13],"tumbles":[]},{"spinsLeft":9,"area":[[7,9,9,8,8],[8,9,6,4,6],[7,9,6,7,6],[5,8,8,2,5],[6,7,6,8,8],[4,4,9,9,6]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":8,"area":[[4,1,3,3,9],[8,2,6,6,9],[8,8,9,9,6],[5,5,7,7,9],[2,3,14,22,7],[4,6,2,8,8]],"totalWin":0,"multipliers":[14,22],"tumbles":[]},{"spinsLeft":7,"area":[[8,8,3,10,4],[0,7,7,9,9],[6,6,4,4,9],[8,8,13,20,8],[9,6,6,7,6],[5,7,6,2,9]],"totalWin":0,"multipliers":[13,10,20],"tumbles":[]},{"spinsLeft":6,"area":[[6,9,5,9,5],[2,0,7,7,9],[5,5,7,7,7],[9,4,4,9,9],[1,9,7,9,9],[9,9,8,8,4]],"totalWin":6498,"multipliers":[22,15,10,12],"tumbles":[{"symbols":{"in":[[9,4],[4],[],[2,8,8],[8,8,7],[7,7]],"out":[{"symbol":9,"count":11,"win":7.5}]},"win":7.5},{"symbols":{"in":[[],[9,8],[5,5,8],[],[9,7],[6,9]],"out":[{"symbol":7,"count":9,"win":5}]},"win":5},{"symbols":{"in":[[],[9],[5],[4,4],[6,7],[5,9]],"out":[{"symbol":8,"count":8,"win":4}]},"win":4},{"symbols":{"in":[[8,8],[],[6,7,6,9,7],[],[],[4]],"out":[{"symbol":5,"count":8,"win":10}]},"win":10},{"symbols":{"in":[[8],[7],[],[6,6,7,4],[],[6,7]],"out":[{"symbol":4,"count":8,"win":10}]},"win":10},{"symbols":{"in":[[7],[],[12,8],[3,6],[5],[4,4]],"out":[{"symbol":6,"count":8,"win":8}]},"win":8},{"symbols":{"in":[[5],[7],[9,9],[9],[7,6],[7]],"out":[{"symbol":7,"count":8,"win":5}]},"win":5},{"symbols":{"in":[[8],[7,4],[7,7,5],[9],[22],[15,10]],"out":[{"symbol":9,"count":10,"win":7.5}]},"win":7.5}]},{"spinsLeft":5,"area":[[4,9,2,7,8],[5,7,7,8,8],[4,9,9,7,8],[1,3,3,6,3],[5,1,2,3,14],[10,15,0,9,9]],"totalWin":0,"multipliers":[10,15,14],"tumbles":[]},{"spinsLeft":4,"area":[[8,4,4,1,3],[5,5,7,7,8],[8,8,12,5,5],[5,8,8,2,5],[3,6,1,9,7],[8,8,6,5,7]],"totalWin":16,"multipliers":[12],"tumbles":[{"symbols":{"in":[[7],[9],[6,9],[6,9],[],[3,8]],"out":[{"symbol":8,"count":8,"win":4}]},"win":4}]},{"spinsLeft":3,"area":[[3,3,9,5,5],[4,6,9,9,8],[7,7,5,5,8],[20,8,8,5,9],[7,7,9,9,3],[9,5,5,7,7]],"totalWin":0,"multipliers":[20],"tumbles":[]},{"spinsLeft":2,"area":[[8,8,5,5,8],[7,8,8,9,6],[7,7,9,6,7],[8,5,5,6,6],[9,7,7,9,9],[9,9,8,8,6]],"totalWin":56,"multipliers":[],"tumbles":[{"symbols":{"in":[[7,7,4],[2,8],[],[6],[],[7,7]],"out":[{"symbol":8,"count":8,"win":4}]},"win":4},{"symbols":{"in":[[8,5],[5],[9,7,7],[],[7,9],[6,4]],"out":[{"symbol":7,"count":10,"win":10}]},"win":10},{"symbols":{"in":[[],[6],[7,7],[],[9,9,4,4],[7,6]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5},{"symbols":{"in":[[],[7,7],[8],[8,5,5],[],[9,9,4]],"out":[{"symbol":6,"count":9,"win":8}]},"win":8},{"symbols":{"in":[[9,7,9],[9,8,8],[2,6,1,3],[8,5,5,6],[9],[9]],"out":[{"symbol":7,"count":8,"win":5},{"symbol":5,"count":8,"win":10}]},"win":15},{"symbols":{"in":[[7,2],[5],[],[],[9,4,4],[8,8,9]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5},{"symbols":{"in":[[3],[6,4,6],[8],[9,9],[],[6,7]],"out":[{"symbol":8,"count":9,"win":4}]},"win":4},{"symbols":{"in":[[8],[7],[],[],[6,8,8,6],[5,5]],"out":[{"symbol":4,"count":8,"win":10}]},"win":10}]},{"spinsLeft":1,"area":[[8,8,3,10,4],[7,9,9,5,4],[5,5,7,7,7],[9,9,7,0,8],[6,6,6,8,8],[6,5,7,6,2]],"totalWin":0,"multipliers":[10],"tumbles":[]}]}};
                    return data;
                }
                else if (this.gameData.debugged == -104){ // 15 spins 
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[9,7,7,9,9],[9,9,1,8,8],[8,9,7,7,9],[6,3,3,6,6],[4,4,9,9,5],[7,7,9,9,8]],"totalWin":226,"tumbles":[{"symbols":{"in":[[8,5,5],[6,0],[8,7],[],[8,9],[0,8]],"out":[{"symbol":9,"count":11,"win":7.5}]},"win":7.5},{"symbols":{"in":[[5],[8,7],[7,7],[],[5],[6,9]],"out":[{"symbol":8,"count":8,"win":4}]},"win":4},{"symbols":{"in":[[7,5],[9],[5,5,8,8,2],[],[],[5,9]],"out":[{"symbol":7,"count":10,"win":10}]},"win":10},{"symbols":{"in":[[7,7,6,6],[],[4,6],[],[0,7],[4]],"out":[{"symbol":5,"count":9,"win":10}]},"win":10},{"symbols":{"in":[[4,4],[4],[9],[8,0,7],[],[7]],"out":[{"symbol":6,"count":8,"win":8}]},"win":8}],"freeSpin":[{"spinsLeft":10,"area":[[4,7,7,7,6],[8,8,2,0,7],[8,9,7,7,9],[3,6,3,3,6],[5,1,2,3,7],[8,4,4,4,3]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":9,"area":[[7,7,7,6,2],[9,9,8,8,9],[9,6,9,7,5],[7,0,8,9,4],[4,7,7,7,8],[9,9,8,8,6]],"totalWin":16.5,"multipliers":[],"tumbles":[{"symbols":{"in":[[8,8,5],[4,5,9],[8,8,3],[7,5],[9,2,5],[9,9]],"out":[{"symbol":7,"count":8,"win":5},{"symbol":9,"count":8,"win":2.5}]},"win":7.5},{"symbols":{"in":[[8,8],[6,2],[8,2],[5],[2],[8,9]],"out":[{"symbol":8,"count":10,"win":9}]},"win":9}]},{"spinsLeft":8,"area":[[5,7,7,6,6],[8,8,2,0,7],[9,0,2,4,4],[6,9,9,9,8],[3,7,0,9,4],[9,6,6,1,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":12,"area":[[9,11,7,7,9],[1,8,8,2,0],[9,7,8,8,9],[12,9,2,4,4],[7,9,9,5,5],[5,7,6,6,4]],"totalWin":0,"multipliers":[12,11],"tumbles":[]},{"spinsLeft":11,"area":[[5,8,8,9,11],[9,5,5,6,8],[5,5,8,8,9],[6,6,6,9,9],[4,9,9,5,5],[4,4,9,9,6]],"totalWin":37.5,"multipliers":[11],"tumbles":[{"symbols":{"in":[[1],[4],[2],[5,8],[5,9],[9,3]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5},{"symbols":{"in":[[5],[4,6],[7,7],[5],[5,9,8],[]],"out":[{"symbol":5,"count":9,"win":10}]},"win":10}]},{"spinsLeft":10,"area":[[8,8,3,4,9],[7,7,8,8,9],[5,7,7,7,9],[9,8,8,7,5],[1,9,7,9,9],[8,6,5,7,6]],"totalWin":16.5,"multipliers":[],"tumbles":[{"symbols":{"in":[[],[9,6],[2,0,9],[8],[9],[7]],"out":[{"symbol":7,"count":8,"win":5}]},"win":5},{"symbols":{"in":[[4,7,8],[5,7,9,6],[0,9],[6,3,3,6],[8,9,9,4],[5]],"out":[{"symbol":8,"count":8,"win":4},{"symbol":9,"count":10,"win":7.5}]},"win":11.5}]},{"spinsLeft":9,"area":[[5,7,6,8,8],[9,9,4,4,1],[4,9,9,7,8],[8,8,5,9,6],[6,6,5,5,1],[5,5,7,6,6]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":8,"area":[[9,5,7,6,8],[9,8,8,9,4],[3,3,14,1,6],[5,7,7,9,9],[8,4,4,9,9],[6,9,6,7,7]],"totalWin":15,"multipliers":[14],"tumbles":[{"symbols":{"in":[[7],[2,8],[],[5,5],[8,8],[5]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5}]},{"spinsLeft":7,"area":[[8,9,11,7,7],[5,5,8,8,2],[7,9,6,7,6],[5,5,6,6,9],[2,9,6,6,5],[2,9,9,8,8]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":6,"area":[[8,3,4,9,4],[4,4,1,3,10],[2,8,8,5,5],[5,4,6,12,9],[7,6,8,8,6],[4,9,9,6,6]],"totalWin":0,"multipliers":[12,10],"tumbles":[]},{"spinsLeft":5,"area":[[11,7,7,9,9],[5,7,7,8,8],[8,8,5,5,7],[9,2,4,4,7],[8,8,9,5,2],[6,4,4,9,9]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":4,"area":[[8,4,4,1,3],[6,6,9,9,4],[9,7,5,5,9],[8,5,9,6,5],[9,7,7,9,9],[8,8,6,9,6]],"totalWin":2.5,"multipliers":[],"tumbles":[{"symbols":{"in":[[],[8,8],[5,4],[6],[9,1,6],[9]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5}]},{"spinsLeft":3,"area":[[7,8,8,7,4],[5,7,7,8,8],[7,7,7,9,9],[9,9,8,5,5],[9,9,3,3,6],[9,8,8,6,9]],"totalWin":11.5,"multipliers":[],"tumbles":[{"symbols":{"in":[[],[],[3,9],[9,6],[8,8],[3,8]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5},{"symbols":{"in":[[2,9],[4,9],[],[8],[8,6],[9,4,4]],"out":[{"symbol":8,"count":10,"win":9}]},"win":9}]},{"spinsLeft":2,"area":[[6,6,7,7,7],[7,9,9,5,4],[4,9,9,7,8],[3,6,3,3,6],[7,9,9,3,3],[7,8,8,9,15]],"totalWin":0,"multipliers":[15],"tumbles":[]},{"spinsLeft":1,"area":[[6,2,8,8,3],[2,6,6,6,9],[0,2,4,4,9],[6,3,3,6,6],[8,9,5,2,9],[8,8,6,9,6]],"totalWin":8,"multipliers":[],"tumbles":[{"symbols":{"in":[[5],[5,9,7],[],[6,3,3],[],[6,4]],"out":[{"symbol":6,"count":9,"win":8}]},"win":8}]}]}};
                    return data;
                }
                else if (this.gameData.debugged == -105) { // 2 tumbles, no free spins
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[5,5,8,8,9],[8,9,6,4,6],[1,6,2,8,8],[7,6,6,6,9],[5,0,2,9,6],[9,8,8,6,5]],"totalWin":10.5,"tumbles":[{"symbols":{"in":[[],[4,6],[9],[6,3,3],[9],[9]],"out":[{"symbol":6,"count":8,"win":8}]},"win":8},{"symbols":{"in":[[1],[5],[7],[9],[5,9],[2,6]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5}],"freeSpin":[]}};
                    return data;
                }
                else if (this.gameData.debugged == -106) { // 10 spins, 100x bomb
                    const data = {"playerId":"2","bet":"0.2","slot":{"area":[[2,3,4,0,1],[5,7,8,0,6],[9,2,9,1,3],[4,2,9,1,3],[0,8,7,5,6],[2,3,0,9,1]],"totalWin":18.290000000000006,"tumbles":[],"freeSpin":[{"spinsLeft":10,"area":[[8,8,7,4,7],[11,7,5,5,8],[4,4,9,6,6],[7,5,5,7,7],[7,9,9,5,5],[6,6,4,4,9]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":9,"area":[[9,5,7,6,8],[2,6,6,9,9],[7,7,9,6,7],[8,8,5,9,6],[9,9,3,3,6],[7,7,8,8,9]],"totalWin":0.05,"multipliers":[],"tumbles":[{"symbols":{"in":[[7],[9,6],[4],[9],[8,9],[9]],"out":[{"symbol":9,"count":8,"win":0.05}]},"win":0.05}]},{"spinsLeft":8,"area":[[4,7,7,7,6],[5,5,6,8,8],[6,3,8,8,5],[9,9,7,0,8],[6,7,6,8,8],[1,9,5,5,7]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":7,"area":[[4,4,1,3,3],[7,7,9,9,9],[7,9,6,7,6],[8,8,5,9,6],[8,6,6,6,8],[7,6,6,4,4]],"totalWin":16.000000000000004,"multipliers":[22],"tumbles":[{"symbols":{"in":[[],[],[7,5],[9],[9,7,22],[4,8]],"out":[{"symbol":6,"count":8,"win":0.16000000000000003}]},"win":0.16000000000000003}]},{"spinsLeft":6,"area":[[7,7,6,6,9],[7,8,8,9,6],[5,9,6,6,4],[4,6,9,2,4],[9,3,3,6,1],[8,8,9,7,6]],"totalWin":0.21000000000000002,"multipliers":[],"tumbles":[{"symbols":{"in":[[7,8],[5],[9,6],[8],[9],[9]],"out":[{"symbol":6,"count":8,"win":0.16000000000000003}]},"win":0.16000000000000003},{"symbols":{"in":[[4],[9],[9,7],[7],[5,9],[9,9]],"out":[{"symbol":9,"count":9,"win":0.05}]},"win":0.05}]},{"spinsLeft":5,"area":[[6,2,8,8,3],[3,9,5,5,7],[9,9,7,8,8],[8,5,5,6,6],[9,3,3,6,1],[7,6,2,9,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":4,"area":[[7,8,8,7,4],[5,8,8,2,6],[9,6,7,6,3],[5,5,7,7,9],[4,7,7,7,8],[4,4,4,3,3]],"totalWin":1.1800000000000002,"multipliers":[10],"tumbles":[{"symbols":{"in":[[8,8],[],[2],[8,8],[4,9,7],[]],"out":[{"symbol":7,"count":8,"win":0.1}]},"win":0.1},{"symbols":{"in":[[9,4,4,9],[8,8],[],[6,6],[3],[]],"out":[{"symbol":8,"count":9,"win":0.08000000000000002}]},"win":0.08000000000000002},{"symbols":{"in":[[9,4,4],[],[],[],[9,1],[8,8,9]],"out":[{"symbol":4,"count":8,"win":0.2}]},"win":0.2},{"symbols":{"in":[[7,6,6],[],[5],[9],[6,9],[10]],"out":[{"symbol":9,"count":8,"win":0.05}]},"win":0.05},{"symbols":{"in":[[8,8],[6],[7,7],[4,2],[4],[]],"out":[{"symbol":6,"count":8,"win":0.16000000000000003}]},"win":0.16000000000000003}]},{"spinsLeft":3,"area":[[8,9,7,7,9],[9,4,7,9,5],[6,9,7,5,5],[3,6,3,3,6],[2,3,14,22,7],[15,0,9,9,8]],"totalWin":0,"multipliers":[15,14,22],"tumbles":[]},{"spinsLeft":2,"area":[[4,9,2,7,8],[7,9,9,5,4],[7,7,8,8,9],[0,8,9,4,4],[5,4,7,7,7],[6,7,7,7,9]],"totalWin":0.25,"multipliers":[],"tumbles":[{"symbols":{"in":[[4],[4],[6,9],[],[9,1,6],[1,6,6]],"out":[{"symbol":7,"count":10,"win":0.2}]},"win":0.2},{"symbols":{"in":[[9],[9,7],[9,9],[8],[9],[5]],"out":[{"symbol":9,"count":8,"win":0.05}]},"win":0.05}]},{"spinsLeft":1,"area":[[8,8,7,4,7],[6,4,6,9,9],[5,8,8,9,7],[6,6,9,9,1],[3,6,1,9,7],[8,8,3,10,15]],"totalWin":0,"multipliers":[10,15],"tumbles":[]}]}};
                    return data;
                }
                else if (this.gameData.debugged == -1000){ // max win, TBA, show only MAX WIN instead of doing win overlay.
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[1,2,3,4,6],[2,3,4,6,5],[3,4,6,5,7],[4,6,5,7,8],[5,7,8,9,0],[0,0,0,0,0]],"totalWin":210000,"tumbles":[],"freeSpin":[{"spinsLeft":1,"area":[[10,1,1,1,1],[1,2,19,2,1],[2,2,2,22,2],[4,4,20,4,4],[4,11,2,2,4],[4,1,1,21,4]],"totalWin":210000,"multipliers":[10,19,20,21,22,23],"tumbles":[{"win":1050,"symbols":{"in":[[1,2,3,4,5],[2,3,4,5,6],[3,4,5,6,7],[4,5,6,7,8],[5,6,7,8,9],[6,7,8,9,1]],"out":[{"symbol":1,"count":8,"win":525},{"symbol":2,"count":8,"win":525},{"symbol":3,"count":8,"win":0}]}}]}],"maxWin":210000}};
                    return data;
                }
                else if (this.gameData.debugged == -107){ // tumble 2 symbols, no free spins
                    const data = {"playerId":"2","bet":"1","slot":{"area":[[8,9,9,7,7],[4,6,6,9,9],[2,2,7,7,9],[8,7,7,3,3],[9,7,7,5,5],[9,9,8,8,6]],"totalWin":1.75,"tumbles":[{"symbols":{"in":[[6,6,7,7],[2,7],[7,7,4],[7,8],[7,7,9],[7,7]],"out":[{"symbol":9,"count":8,"win":0.25},{"symbol":7,"count":8,"win":0.5}]},"win":0.75},{"symbols":{"in":[[5,7],[9],[5,7],[9],[1,6],[9,5]],"out":[{"symbol":7,"count":10,"win":1}]},"win":1}],"freeSpin":[]}};
                    return data;
                }
                else if (this.gameData.debugged == -108){ // 15 free spins
                    const data = {"playerId":"2","bet":"40","slot":{"area":[[2,3,4,0,1],[0,7,6,8,5],[9,9,3,1,2],[2,4,3,9,1],[6,7,0,5,8],[9,2,0,3,1]],"totalWin":2206,"tumbles":[],"freeSpin":[{"spinsLeft":10,"area":[[4,9,9,6,6],[8,6,6,7,7],[5,8,8,6,6],[8,6,6,9,9],[9,0,8,8,7],[7,7,6,6,9]],"totalWin":74,"multipliers":[],"tumbles":[{"symbols":{"in":[[8,8],[1,1],[6,9],[5,5],[],[6,3]],"out":[{"symbol":6,"count":10,"win":48}]},"win":48},{"symbols":{"in":[[7,2],[9],[8,8],[5],[9,2],[]],"out":[{"symbol":8,"count":8,"win":16}]},"win":16},{"symbols":{"in":[[9,8],[4],[9],[0,3],[8,9],[7]],"out":[{"symbol":9,"count":9,"win":10}]},"win":10}]},{"spinsLeft":9,"area":[[8,7,7,4,4],[5,5,7,7,4],[4,4,8,8,9],[8,5,5,9,9],[9,0,8,8,7],[5,5,8,8,9]],"totalWin":308,"multipliers":[],"tumbles":[{"symbols":{"in":[[9],[],[7,7],[7],[7,9],[8,8]],"out":[{"symbol":8,"count":8,"win":16}]},"win":16},{"symbols":{"in":[[9,6],[7,7],[9,9],[2],[9,2],[]],"out":[{"symbol":7,"count":9,"win":20}]},"win":20},{"symbols":{"in":[[9,9],[],[8,8,5],[5,8],[8,5,5],[8]],"out":[{"symbol":9,"count":11,"win":30}]},"win":30},{"symbols":{"in":[[],[7,5],[3],[9,9,8],[7,8],[8,8]],"out":[{"symbol":5,"count":10,"win":60}]},"win":60},{"symbols":{"in":[[],[],[9,9],[8,7],[9,9],[7,7,9,9,8]],"out":[{"symbol":8,"count":11,"win":36}]},"win":36},{"symbols":{"in":[[7,7],[],[8,4],[8,8],[4,4],[5,7]],"out":[{"symbol":9,"count":10,"win":30}]},"win":30},{"symbols":{"in":[[6,4,4,7],[9,8,8,5],[6,6,9],[6],[3,8,8],[1,8,8]],"out":[{"symbol":7,"count":10,"win":40},{"symbol":4,"count":8,"win":40}]},"win":80},{"symbols":{"in":[[],[2,2],[9],[4,4,8],[6,6],[8,8,5]],"out":[{"symbol":8,"count":11,"win":36}]},"win":36}]},{"spinsLeft":8,"area":[[5,8,8,7,7],[9,0,3,3,7],[7,3,3,9,9],[8,4,4,7,7],[0,8,8,7,7],[8,0,7,7,5]],"totalWin":840,"multipliers":[18],"tumbles":[{"symbols":{"in":[[6,6],[4],[4],[5,5],[8,5],[8,8]],"out":[{"symbol":7,"count":10,"win":40}]},"win":40},{"symbols":{"in":[[3,18],[],[],[9],[7,7,9],[6,8,8]],"out":[{"symbol":8,"count":9,"win":16}]},"win":16}]},{"spinsLeft":12,"area":[[6,6,8,8,9],[7,4,4,9,9],[4,4,2,2,7],[7,11,9,9,5],[5,9,9,8,8],[9,7,7,9,9]],"totalWin":90,"multipliers":[11],"tumbles":[{"symbols":{"in":[[9],[5,9],[],[8,8],[4,9],[9,9,5]],"out":[{"symbol":9,"count":10,"win":30}]},"win":30}]},{"spinsLeft":11,"area":[[6,9,9,2,2],[6,1,1,8,8],[5,9,9,4,4],[8,8,6,6,9],[8,5,5,9,9],[4,9,9,8,8]],"totalWin":86,"multipliers":[],"tumbles":[{"symbols":{"in":[[8,5],[],[5,5],[9],[8,8],[7,9]],"out":[{"symbol":9,"count":9,"win":10}]},"win":10},{"symbols":{"in":[[7],[7,5],[],[7,7],[5,5,7],[6,6]],"out":[{"symbol":8,"count":10,"win":36}]},"win":36},{"symbols":{"in":[[3],[6],[7,2,2],[],[9,2,2,8],[]],"out":[{"symbol":5,"count":9,"win":40}]},"win":40}]},{"spinsLeft":10,"area":[[5,5,8,8,7],[9,5,5,8,8],[8,6,6,3,3],[8,8,9,9,4],[9,9,7,7,4],[7,7,8,8,1]],"totalWin":16,"multipliers":[],"tumbles":[{"symbols":{"in":[[8,4],[9,4],[8],[6,6],[],[6,6]],"out":[{"symbol":8,"count":9,"win":16}]},"win":16}]},{"spinsLeft":9,"area":[[4,8,8,0,9],[6,6,1,1,8],[7,7,9,9,5],[5,9,9,6,6],[9,9,8,8,7],[7,5,5,9,9]],"totalWin":10,"multipliers":[],"tumbles":[{"symbols":{"in":[[5],[],[7,8],[9,9],[9,9],[9,4]],"out":[{"symbol":9,"count":9,"win":10}]},"win":10}]},{"spinsLeft":8,"area":[[9,9,3,3,7],[9,9,8,8,6],[8,9,9,7,7],[0,8,8,9,9],[8,7,7,3,3],[7,7,8,8,1]],"totalWin":46,"multipliers":[],"tumbles":[{"symbols":{"in":[[7,7],[9,9,6,6],[0,2,4],[9,1,1,9],[5],[9,5]],"out":[{"symbol":9,"count":8,"win":10},{"symbol":8,"count":8,"win":16}]},"win":26},{"symbols":{"in":[[1,1,9],[],[8,6],[],[3,3],[8,9]],"out":[{"symbol":7,"count":9,"win":20}]},"win":20}]},{"spinsLeft":7,"area":[[3,6,6,8,8],[10,3,3,7,7],[1,5,5,9,9],[5,5,8,8,6],[9,0,8,8,7],[8,8,9,9,4]],"totalWin":32,"multipliers":[10],"tumbles":[{"symbols":{"in":[[9,6],[],[],[5,5],[7,7],[7,9]],"out":[{"symbol":8,"count":8,"win":16}]},"win":16}]},{"spinsLeft":6,"area":[[8,7,7,4,4],[8,8,6,6,7],[9,9,7,7,6],[5,8,8,6,6],[9,4,4,8,8],[5,9,9,8,8]],"totalWin":16,"multipliers":[],"tumbles":[{"symbols":{"in":[[7],[7,3],[],[4,8],[4,4],[8,8]],"out":[{"symbol":8,"count":9,"win":16}]},"win":16}]},{"spinsLeft":5,"area":[[6,5,5,8,8],[6,6,1,1,8],[5,5,8,8,6],[9,6,6,8,8],[8,8,9,9,7],[9,4,4,8,8]],"totalWin":36,"multipliers":[],"tumbles":[{"symbols":{"in":[[6,4],[1],[2,2],[9,1],[1,1],[9,9]],"out":[{"symbol":8,"count":11,"win":36}]},"win":36}]},{"spinsLeft":4,"area":[[0,9,9,3,3],[7,2,2,8,8],[2,2,7,7,9],[9,6,6,8,8],[9,0,8,8,7],[5,5,6,6,8]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":3,"area":[[6,8,8,9,9],[4,4,9,9,6],[9,7,7,6,6],[5,5,2,2,9],[9,6,6,1,1],[9,8,8,0,7]],"totalWin":42,"multipliers":[],"tumbles":[{"symbols":{"in":[[3,3],[6,8],[9],[6],[9],[7]],"out":[{"symbol":9,"count":8,"win":10}]},"win":10},{"symbols":{"in":[[9],[7,6],[8,8],[5],[7,9],[]],"out":[{"symbol":6,"count":8,"win":32}]},"win":32}]},{"spinsLeft":2,"area":[[9,1,1,5,5],[9,9,6,6,1],[5,5,9,9,11],[3,3,0,8,8],[5,8,8,7,7],[7,4,4,9,9]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":1,"area":[[2,2,7,7,5],[6,6,7,7,2],[5,5,9,9,12],[9,7,7,11,9],[7,7,5,5,8],[5,9,9,7,7]],"totalWin":490,"multipliers":[12,11],"tumbles":[{"symbols":{"in":[[8,8],[6,9],[],[8,9],[9,5],[9,9]],"out":[{"symbol":7,"count":10,"win":40}]},"win":40},{"symbols":{"in":[[],[6],[4,0],[8,0,3],[7],[9,1,1,8]],"out":[{"symbol":9,"count":11,"win":30}]},"win":30}]}]}};
                    return data;
                }
               

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