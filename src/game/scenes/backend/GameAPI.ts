import { GameData } from "../components/GameData";

export class GameAPI {  
    gameData: GameData;
    constructor(gameData: GameData) {
        this.gameData = gameData;
    }   

    private async generateGameUrlToken(): Promise<{url: string, token: string}> {
        const apiUrl = 'https://game-launcher.torrospins.com/api/v2/generate_url';
        
        const requestBody = {
            operator_id: "18b03717-33a7-46d6-9c70-acee80c54d03",
            bank_id: "1", 
            player_id: 2,
            casino_bank_id: "1",
            game_name: "SugarWonderland",
            device: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? "mobile" : "desktop",
            lang: "en",
            currency: "USD", 
            quit_link: "www.quit.com",
            is_demo: 0,
            free_spin: "1",
            session: "zxc11asd1zxc",
            player_name: "test",
            modify_uid: "111"
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
            console.log('Starting gameLauncher...');
            const {url, token} = await this.generateGameUrlToken();
            console.log('generateGameUrl response:', {url, token});
            localStorage.setItem('gameToken', token);
            //console.log('URL type:', typeof url, 'Token type:', typeof token);
            
            if (!url || !token) {
                console.error('URL or token is missing from API response');
                return;
            }
            
            localStorage.setItem('gameToken', token);
        } catch (error) {
            console.error('Error in gameLauncher:', error);
        }
    }
    public async getBalance(): Promise<any> {
        try{
            const response = await fetch('https://game-launcher.torrospins.com/api/v2/slots/balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('gameToken')}`
                },
                body: JSON.stringify({
                    action: 'get_balance',
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            this.gameData.debugError('Error in getBalance:', error);
            throw error;
        }
    }

    public async doSpin(bet: number): Promise<any> {
        try {
            // Decrypt the stored token
          // const decryptData = (encryptedData: string): string => {
          //     const key = "T0rr0Sp1nsS3cur3K3y";
          //     const encrypted = atob(encryptedData); // Base64 decode
          //     let decrypted = '';
          //     for(let i = 0; i < encrypted.length; i++) {
          //         decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
          //     }
          //     return decrypted;
          // };
//
          //  const token = decryptData(this.gameData.gameToken);
            const response = await fetch('https://game-launcher.torrospins.com/api/v2/slots/bet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('gameToken')}`
                },
                body: JSON.stringify({
                    action: 'spin',
                    bet: bet.toString(),
                    line: 2
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            //console.error('Error placing bet:', error);
            throw error;
        }
    }
}   