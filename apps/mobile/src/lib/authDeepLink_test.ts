import { assertEquals } from 'jsr:@std/assert';
import { isAllowedAuthDeepLink } from './authDeepLink.ts';

Deno.test('isAllowedAuthDeepLink accepts valid official HTTPS URLs', () => {
  assertEquals(isAllowedAuthDeepLink('https://painelprime.com.br/signup?code=123456'), true);
  assertEquals(isAllowedAuthDeepLink('https://app.painelprime.com.br/cadastro?phone=11999999999&code=654321'), true);
  assertEquals(isAllowedAuthDeepLink('https://www.painelprime.com.br/auth/callback#access_token=xyz'), true);
  assertEquals(isAllowedAuthDeepLink('https://www.app.painelprime.com.br/auth/callback'), true);
});

Deno.test('isAllowedAuthDeepLink accepts valid custom scheme URLs', () => {
  assertEquals(isAllowedAuthDeepLink('painelprime://signup?code=123456'), true);
  assertEquals(isAllowedAuthDeepLink('painelprime://auth?code=123456'), true);
  assertEquals(isAllowedAuthDeepLink('painelprime://aceitar-convite?token=abc'), true);
});

Deno.test('isAllowedAuthDeepLink rejects external domains and malicious protocols', () => {
  assertEquals(isAllowedAuthDeepLink('https://evil.com/signup?code=123456'), false);
  assertEquals(isAllowedAuthDeepLink('http://painelprime.com.br/signup?code=123456'), false);
  assertEquals(isAllowedAuthDeepLink('javascript:alert(1)'), false);
  assertEquals(isAllowedAuthDeepLink('painelprime://malicious-route?code=123456'), false);
  assertEquals(isAllowedAuthDeepLink('https://evil.com@painelprime.com.br/signup?code=123456'), false);
  assertEquals(isAllowedAuthDeepLink('https://painelprime.com.br/signup-evil?code=123456'), false);
  assertEquals(isAllowedAuthDeepLink('painelprime:///authentication?code=123456'), false);
  assertEquals(isAllowedAuthDeepLink(''), false);
  assertEquals(isAllowedAuthDeepLink(null), false);
  assertEquals(isAllowedAuthDeepLink(undefined), false);
});
