import axios, { type AxiosRequestConfig, type Method } from 'axios';

const localApiUrl = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:4000/api`
  : 'http://localhost:4000/api';

const apiCandidates = [
  import.meta.env.VITE_API_URL,
  localApiUrl,
  'http://localhost:4000/api',
  'http://localhost:4001/api',
  'http://localhost:4002/api',
  'http://localhost:4003/api',
].filter((value): value is string => Boolean(value && value.trim().length));

export const googleAuthUrl = () => `${(apiCandidates[0] || window.location.origin).replace(/\/api\/?$/, '')}/api/auth/google`;

const buildClient = (baseURL: string) => axios.create({ baseURL, withCredentials: true });

const executeWithFallback = async <T = any>(method: Method, path: string, config?: AxiosRequestConfig) => {
  let lastError: unknown;

  for (const baseURL of apiCandidates) {
    try {
      const client = buildClient(baseURL);
      return await client.request<T>({
        ...config,
        method,
        url: path.startsWith('/') ? path : `/${path}`,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to reach the Pulse API.');
};

export const api = {
  get: <T = any>(path: string, config?: AxiosRequestConfig) => executeWithFallback<T>('get', path, config),
  post: <T = any>(path: string, data?: unknown, config?: AxiosRequestConfig) =>
    executeWithFallback<T>('post', path, { ...config, data }),
  put: <T = any>(path: string, data?: unknown, config?: AxiosRequestConfig) =>
    executeWithFallback<T>('put', path, { ...config, data }),
  delete: <T = any>(path: string, config?: AxiosRequestConfig) => executeWithFallback<T>('delete', path, config),
};

export const get = async <T = any>(path: string) => {
  const { data } = await api.get<{ data: T }>(`/${path.replace(/^\/+/, '')}`);
  return data.data as T;
};
