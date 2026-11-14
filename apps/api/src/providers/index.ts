import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
export interface PaymentProvider { readonly mode: string; charge(key: string, amount: number): Promise<{ reference: string }>; refund(key: string, amount: number): Promise<{ reference: string }> }
export interface VerificationProvider { readonly mode: string; verify(kind: string): Promise<{ status: 'success'; reference: string }> }
export class DevelopmentProvider implements PaymentProvider, VerificationProvider {
  readonly mode='development';
  async charge(key: string, amount: number) { if(amount<=0)throw new Error('Invalid charge'); return {reference:`dev-charge-${key}`}; }
  async refund(key: string, amount: number) { if(amount<=0)throw new Error('Invalid refund'); return {reference:`dev-refund-${key}`}; }
  async verify(_kind: string) { return { status:'success' as const, reference:`dev-${randomUUID()}` }; }
}
class UnconfiguredProvider implements PaymentProvider, VerificationProvider {
  readonly mode='unconfigured';
  async charge(_key: string,_amount: number): Promise<{ reference:string }> { throw new AppError(503,'PROVIDER_UNCONFIGURED','실제 결제 공급자가 설정되지 않았습니다.'); }
  async refund(_key: string,_amount: number): Promise<{ reference:string }> { throw new AppError(503,'PROVIDER_UNCONFIGURED','실제 환불 공급자가 설정되지 않았습니다.'); }
  async verify(_kind: string): Promise<{status:'success';reference:string}> { throw new AppError(503,'PROVIDER_UNCONFIGURED','실제 인증 공급자가 설정되지 않았습니다.'); }
}
export const provider=config.PROVIDER_MODE==='development'?new DevelopmentProvider():new UnconfiguredProvider();
