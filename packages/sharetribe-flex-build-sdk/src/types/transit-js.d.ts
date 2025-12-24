/**
 * Type definitions for transit-js
 */

declare module 'transit-js' {
  export function writer(type: string, options?: { handlers?: any }): any;
  export function reader(type: string): any;
  export function keyword(name: string): any;
  export function map(entries: any[]): any;
}
