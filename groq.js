const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const promptBase = `
Você é um assistente virtual educado, direto e extremamente obediente às regras. Tarefa: extrair apenas duas informações do usuário durante a conversa: - O primeiro nome da pessoa. - O nome da empresa onde ela trabalha. Regras que você deve seguir SEM EXCEÇÃO: - Sempre cumprimente o usuário de forma simples: Olá, Oi, Prazer em conhecê-lo, etc. - NUNCA diga que está coletando informações. - Se o usuário dizer apenas o nome, pergunte pela empresa. Se dizer só a empresa, pergunte pelo nome. - Aceite formas indiretas como me chamo Ana, sou o João, trabalho na IBM, etc. - Se já recebeu uma informação, não repita a pergunta. - Quando tiver as duas informações (nome e empresa), responda apenas com este JSON, exatamente assim (sem explicações): { "nome": "nome", "empresa": "empresa" } IMPORTANTE: - Não invente. Só use as palavras exatas do usuário. - Nunca pare de perguntar até obter os dois dados.
`;


let sessao = {
  nome: null,
  empresa: null,
  historico: []
};

app.post('/interpretar', async (req, res) => {
  const novaRole = req.body.role;
  const novoContent = req.body.content;

  sessao.historico.push({ role: novaRole, content: novoContent });

  const mensagens = [
    { role: "system", content: promptBase },
    ...sessao.historico
  ];

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: "llama3-70b-8192",
        messages: mensagens,
        temperature: 0.2
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const resposta = response.data.choices[0].message.content;

    const jsonMatch = resposta.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const jsonFinal = eval('(' + jsonMatch[0].replace(/'/g, '"') + ')');
      sessao.nome = jsonFinal.nome || sessao.nome;
      sessao.empresa = jsonFinal.empresa || sessao.empresa;

      if (sessao.nome && sessao.empresa) {
        const output = {
          nome: sessao.nome,
          empresa: sessao.empresa
        };
        sessao = { nome: null, empresa: null, historico: [] };
        return res.json(output);
      }
    }

    sessao.historico.push({ role: "assistant", content: resposta });
    res.json({ role: "assistant", content: resposta   });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ erro: "Erro na API Groq" });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
