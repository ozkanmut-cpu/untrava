export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

export function apiError(code: string, message: string): ApiErrorEnvelope {
  return { error: { code, message } };
}
