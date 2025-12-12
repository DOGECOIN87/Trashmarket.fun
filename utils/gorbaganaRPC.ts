import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';

// Types for RPC responses
interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface BalanceResult {
  value: number;
}

interface AccountInfo {
  data: string[];
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
}

interface TokenAccount {
  pubkey: string;
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          owner: string;
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmount: number;
          };
        };
        type: string;
      };
      program: string;
      space: number;
    };
    executable: boolean;
    lamports: number;
    owner: string;
  };
}

// Gorbagana RPC Client
class GorbaganaRPC {
  private endpoint: string;
  private requestId: number = 0;

  constructor(endpoint: string = GORBAGANA_CONFIG.rpcEndpoint) {
    this.endpoint = endpoint;
  }

  private async request<T>(method: string, params: any[] = []): Promise<T> {
    this.requestId++;
    
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.requestId,
          method,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: RpcResponse<T> = await response.json();

      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      return data.result as T;
    } catch (error) {
      console.error(`RPC request failed (${method}):`, error);
      throw error;
    }
  }

  // Get account balance in GOR
  async getBalance(address: string): Promise<number> {
    const result = await this.request<BalanceResult>('getBalance', [address]);
    return result.value / Math.pow(10, GORBAGANA_CONFIG.currency.decimals);
  }

  // Get account info
  async getAccountInfo(address: string): Promise<AccountInfo | null> {
    const result = await this.request<{ value: AccountInfo | null }>('getAccountInfo', [
      address,
      { encoding: 'base64' },
    ]);
    return result.value;
  }

  // Get recent blockhash for transactions
  async getRecentBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    const result = await this.request<{
      value: { blockhash: string; lastValidBlockHeight: number };
    }>('getLatestBlockhash', [{ commitment: 'finalized' }]);
    return result.value;
  }

  // Get token accounts by owner (for NFTs)
  async getTokenAccountsByOwner(
    owner: string,
    programId: string = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' // Token Program ID
  ): Promise<TokenAccount[]> {
    const result = await this.request<{ value: TokenAccount[] }>('getTokenAccountsByOwner', [
      owner,
      { programId },
      { encoding: 'jsonParsed' },
    ]);
    return result.value;
  }

  // Get NFTs owned by an address (tokens with amount = 1)
  async getNFTsByOwner(owner: string): Promise<TokenAccount[]> {
    const tokens = await this.getTokenAccountsByOwner(owner);
    return tokens.filter(
      (token) => 
        token.account.data.parsed.info.tokenAmount.uiAmount === 1 &&
        token.account.data.parsed.info.tokenAmount.decimals === 0
    );
  }

  // Send transaction
  async sendTransaction(signedTransaction: string): Promise<string> {
    const signature = await this.request<string>('sendTransaction', [
      signedTransaction,
      { encoding: 'base64', preflightCommitment: 'confirmed' },
    ]);
    return signature;
  }

  // Confirm transaction
  async confirmTransaction(
    signature: string,
    timeout: number = 30000
  ): Promise<boolean> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const result = await this.request<{
          value: { confirmationStatus: string; err: any } | null;
        }>('getSignatureStatuses', [[signature]]);

        if (result.value?.[0]) {
          const status = result.value[0];
          if (status.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
          }
          if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
            return true;
          }
        }
      } catch (error) {
        // Continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Transaction confirmation timeout');
  }

  // Get current slot
  async getSlot(): Promise<number> {
    return this.request<number>('getSlot');
  }

  // Get block time
  async getBlockTime(slot: number): Promise<number | null> {
    return this.request<number | null>('getBlockTime', [slot]);
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.getSlot();
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const gorbaganaRPC = new GorbaganaRPC();

// Export class for custom instances
export { GorbaganaRPC };

// Helper to format GOR amounts
export const formatGOR = (amount: number, decimals: number = 2): string => {
  return `${amount.toFixed(decimals)} ${GORBAGANA_CONFIG.currency.displaySymbol}`;
};

// Helper to get explorer links
export const getExplorerLink = (type: 'tx' | 'address' | 'token', value: string): string => {
  const baseUrl = GORBAGANA_CONFIG.explorerUrl;
  switch (type) {
    case 'tx':
      return `${baseUrl}/tx/${value}`;
    case 'address':
      return `${baseUrl}/address/${value}`;
    case 'token':
      return `${baseUrl}/token/${value}`;
    default:
      return baseUrl;
  }
};
