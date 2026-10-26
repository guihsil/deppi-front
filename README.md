# DEPPI Web

Aplicação web do DEPPI em Next.js App Router, React, TypeScript e Tailwind CSS.

## Configuração

Configure `API_BASE_URL` no ambiente (consulte `.env.example`). Essa URL é usada
pelas rotas de API existentes e pelo rewrite `/backend/:path*`, que encaminha as
chamadas do navegador à API sem conflitar com os handlers locais em `/api/*`.
O endereço precisa ser uma URL absoluta HTTP ou HTTPS, sem query string ou
fragmento.

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>.

## Validação

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Rotas da aplicação

- `/login`: autenticação.
- `/admin`, `/deppi`, `/professor` e `/aluno`: áreas protegidas por cargo.
- `/403`: aviso de acesso negado.
- `/`: redireciona para a página inicial do cargo prioritário do usuário.

A sessão do navegador fica em `localStorage` sob a chave `deppi:session`. Uma
resposta HTTP `401` em chamada autenticada encerra a sessão.
