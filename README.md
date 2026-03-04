# 🎉 Festeja Aki - SaaS de Reservas para Salão de Festa

## 🔗 Deploy
[https://seuprojeto.vercel.app](https://projeto-festeja-aki-z5di-gj6slkdxf-felipesaitos-projects.vercel.app/)

## 📌 Sobre o Projeto
Sistema de reservas para salão de festas com:
- Calendário restrito a finais de semana
- Controle de status (Pendente, Confirmada, Cancelada)
- Painel Admin protegido por JWT
- Envio automático para WhatsApp

## 🛠 Tecnologias
- Next.js 16 (Pages Router)
- MongoDB
- JWT (autenticação admin)
- CSS Modules
- Vercel (Deploy)

## 🔐 Autenticação
Sistema de autenticação via cookie httpOnly utilizando JWT com role "admin".

## 📂 Estrutura
/pages
  /api
    /reservas
/models
/lib
/components

## ⚙️ Como rodar localmente
1. Clonar repositório
2. npm install
3. Criar .env.local
4. npm run dev
