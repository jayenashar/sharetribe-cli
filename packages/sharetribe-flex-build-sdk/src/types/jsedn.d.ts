/**
 * Type definitions for jsedn
 */

declare module 'jsedn' {
  export function parse(str: string): any;
  export function kw(name: string): any;
  export function encode(value: any): string;
}
