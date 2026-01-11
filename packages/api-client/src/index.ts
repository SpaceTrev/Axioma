import {
  AuthResponse,
  RegisterInput,
  LoginInput,
  Market,
  CreateMarketInput,
  MarketDetail,
  Order,
  CreateOrderInput,
  Trade,
  Portfolio,
  Balance,
  MarketOrderBook,
  ResolveMarketInput,
} from '@axioma/shared';

// ============================================
// Types
// ============================================

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => string | null;
  setToken?: (token: string | null) => void;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode?: number;
}

// ============================================
// API Client
// ============================================

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private getToken: () => string | null;
  private setToken: (token: string | null) => void;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getToken = config.getToken || (() => this.token);
    this.setToken = config.setToken || ((t) => (this.token = t));
  }

  // ============================================
  // HTTP Helpers
  // ============================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const error: ApiError = {
        error: (data.error as string) || 'Unknown error',
        message: (data.message as string) || 'An error occurred',
        statusCode: response.status,
      };
      throw error;
    }

    return data as T;
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  // ============================================
  // Auth
  // ============================================

  async register(input: RegisterInput): Promise<AuthResponse> {
    const response = await this.post<ApiResponse<AuthResponse>>('/api/auth/register', input);
    this.setToken(response.data.token);
    return response.data;
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const response = await this.post<ApiResponse<AuthResponse>>('/api/auth/login', input);
    this.setToken(response.data.token);
    return response.data;
  }

  async getMe(): Promise<{ id: string; email: string; role: string; balance: Balance | null }> {
    const response = await this.get<ApiResponse<any>>('/api/auth/me');
    return response.data;
  }

  logout(): void {
    this.setToken(null);
  }

  // ============================================
  // Markets
  // ============================================

  async getMarkets(params?: {
    status?: string;
    category?: string;
    search?: string;
  }): Promise<Array<Market & { tradeCount: number }>> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    const path = query ? `/api/markets?${query}` : '/api/markets';

    const response = await this.get<ApiResponse<Array<Market & { tradeCount: number }>>>(path);
    return response.data;
  }

  async getMarket(id: string): Promise<MarketDetail> {
    const response = await this.get<ApiResponse<MarketDetail>>(`/api/markets/${id}`);
    return response.data;
  }

  async createMarket(input: CreateMarketInput): Promise<Market> {
    const response = await this.post<ApiResponse<Market>>('/api/markets', input);
    return response.data;
  }

  async getOrderBook(marketId: string): Promise<{
    YES: MarketOrderBook['YES'] & { bestBid: string | null; bestAsk: string | null; midpoint: string | null };
    NO: MarketOrderBook['NO'] & { bestBid: string | null; bestAsk: string | null; midpoint: string | null };
  }> {
    const response = await this.get<ApiResponse<any>>(`/api/markets/${marketId}/orderbook`);
    return response.data;
  }

  async getTrades(marketId: string, limit?: number): Promise<Trade[]> {
    const path = limit
      ? `/api/markets/${marketId}/trades?limit=${limit}`
      : `/api/markets/${marketId}/trades`;
    const response = await this.get<ApiResponse<Trade[]>>(path);
    return response.data;
  }

  async resolveMarket(marketId: string, input: ResolveMarketInput): Promise<{
    marketId: string;
    winningOutcome: string;
    settledPositions: number;
    cancelledOrders: number;
  }> {
    const response = await this.post<ApiResponse<any>>(`/api/markets/${marketId}/resolve`, input);
    return response.data;
  }

  async cancelMarket(marketId: string): Promise<{
    marketId: string;
    cancelledOrders: number;
  }> {
    const response = await this.post<ApiResponse<any>>(`/api/markets/${marketId}/cancel`);
    return response.data;
  }

  // ============================================
  // Orders
  // ============================================

  async placeOrder(marketId: string, input: CreateOrderInput): Promise<Order & { matchCount: number }> {
    const response = await this.post<ApiResponse<Order & { matchCount: number }>>(
      `/api/markets/${marketId}/orders`,
      input
    );
    return response.data;
  }

  async getOrders(params?: { marketId?: string; status?: string }): Promise<Array<Order & { marketQuestion: string }>> {
    const searchParams = new URLSearchParams();
    if (params?.marketId) searchParams.set('marketId', params.marketId);
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    const path = query ? `/api/orders?${query}` : '/api/orders';

    const response = await this.get<ApiResponse<Array<Order & { marketQuestion: string }>>>(path);
    return response.data;
  }

  async getOrder(id: string): Promise<Order & { trades: any[] }> {
    const response = await this.get<ApiResponse<Order & { trades: any[] }>>(`/api/orders/${id}`);
    return response.data;
  }

  async cancelOrder(id: string): Promise<{ id: string; status: string }> {
    const response = await this.post<ApiResponse<{ id: string; status: string }>>(`/api/orders/${id}/cancel`);
    return response.data;
  }

  // ============================================
  // Portfolio
  // ============================================

  async getPortfolio(): Promise<Portfolio & { summary: any }> {
    const response = await this.get<ApiResponse<Portfolio & { summary: any }>>('/api/portfolio');
    return response.data;
  }

  async getTradeHistory(limit?: number): Promise<Array<Trade & { role: string }>> {
    const path = limit ? `/api/portfolio/trades?limit=${limit}` : '/api/portfolio/trades';
    const response = await this.get<ApiResponse<Array<Trade & { role: string }>>>(path);
    return response.data;
  }

  async getLedgerHistory(limit?: number): Promise<Array<{
    id: string;
    deltaAvailable: string;
    deltaReserved: string;
    reason: string;
    refType: string | null;
    refId: string | null;
    createdAt: string;
  }>> {
    const path = limit ? `/api/portfolio/ledger?limit=${limit}` : '/api/portfolio/ledger';
    const response = await this.get<ApiResponse<any>>(path);
    return response.data;
  }

  // ============================================
  // Dev (Development only)
  // ============================================

  async faucet(amount: number): Promise<{ credited: string; balance: Balance }> {
    const response = await this.post<ApiResponse<{ credited: string; balance: Balance }>>('/api/dev/faucet', {
      amount,
    });
    return response.data;
  }

  async resetAccount(): Promise<{ message: string }> {
    const response = await this.post<ApiResponse<{ message: string }>>('/api/dev/reset');
    return response.data;
  }

  async getStats(): Promise<{
    users: number;
    markets: { total: number; open: number };
    orders: { total: number; open: number };
    trades: number;
  }> {
    const response = await this.get<ApiResponse<any>>('/api/dev/stats');
    return response.data;
  }
}

// ============================================
// Factory
// ============================================

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

// ============================================
// React/React Native hooks helper
// ============================================

export interface UseApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  setToken: (token: string | null) => void;
}

let _clientInstance: ApiClient | null = null;

export function getApiClient(options?: UseApiClientOptions): ApiClient {
  if (!_clientInstance && options) {
    _clientInstance = createApiClient(options);
  }
  if (!_clientInstance) {
    throw new Error('ApiClient not initialized. Call getApiClient with options first.');
  }
  return _clientInstance;
}

export function initApiClient(options: UseApiClientOptions): ApiClient {
  _clientInstance = createApiClient(options);
  return _clientInstance;
}
