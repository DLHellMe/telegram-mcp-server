declare module 'input' {
  export function text(prompt: string): Promise<string>;
  export function password(prompt: string): Promise<string>;
  export function confirm(prompt: string): Promise<boolean>;
  export function select(prompt: string, options: string[]): Promise<string>;
  export function checkbox(prompt: string, options: string[]): Promise<string[]>;
}