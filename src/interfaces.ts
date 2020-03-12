import { EndpointRequest, EndpointSchema as EndpointSchemaRaw } from '@japan-d2/schema-api-endpoint'
import { Options as JsonSchemaValidateOptions } from 'jsonschema'

export interface EndpointSchema <T, U> extends EndpointSchemaRaw<T, U> {
  url: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
}

type Json =
  | string
  | number
  | boolean
  | null
  | { [property: string]: Json }
  | Json[];

export interface RequestParameter {
  url: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  query: Record<string, string | string[]>;
  body: Record<string, Json>;
  headers: Record<string, string>;
}

export interface ResponseParameter {
  statusCode: number;
  body: Record<string, Json>;
  headers: Record<string, string>;
}

export type CallOptions = Partial<{
  validateRequest: JsonSchemaValidateOptions;
  validateResponse: JsonSchemaValidateOptions;
}>
export type Options = Partial<RequestParameter> & CallOptions

type MaskRequired <T, O extends keyof T> = Omit<T, O> & Partial<Pick<T, O>>
type MaskRequiredParameter <T, U, K extends string> = (
  T extends { [Key in K]: object }
  ? U extends { [Key in K]: object }
    ? MaskRequired<T[K], Extract<keyof T[K], keyof U[K]>>
    : T[K]
  : unknown
)

export type EndpointRequestUnknown = EndpointRequest<unknown, unknown, unknown>

type Filter<T, F> = Pick<T, ({
  [K in keyof T]: T[K] extends F ? K : never;
})[keyof T]>

export type CallParameters <T extends EndpointRequestUnknown, O extends Options> = (
  Omit<T, 'query' | 'headers'> & Filter<{
    query: MaskRequiredParameter<T, O, 'query'>;
    headers: MaskRequiredParameter<T, O, 'headers'>;
  }, object> & {
    query?: Record<string, string | string[]>;
    headers?: Record<string, string>;
  }
)

export type Connector = (parameters: RequestParameter) => Promise<ResponseParameter>
