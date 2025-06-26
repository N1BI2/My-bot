const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const dayjs = require("dayjs");
require("dayjs/locale/pt-br");
dayjs.locale("pt-br");

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;
const BASE_URL = process.env.BASE_URL;
const bot = new TelegramBot(TOKEN);
bot.setWebHook(`${BASE_URL}/bot${TOKEN}`);

const DATA_FILE = "dados.json";
let dados = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : { tarefas: {}, horarios: {}, usuarios: [] };

function salvarDados() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
}

function formatarData(d) {
  return dayjs(d).format("DD/MM");
}

function getDiaSemana(dia) {
  return dayjs(dia, "DD/MM").format("dddd").toLowerCase();
}

function responderTarefasPara(data) {
  const tarefas = dados.tarefas[data] || [];
  if (tarefas.length === 0) return `📆 Tarefas para ${data}: Nenhuma registrada.`;
  return `📌 Tarefas para ${data}:\n` + tarefas.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

function responderHorarioPara(data) {
  const diaSemana = getDiaSemana(data);
  const materias = dados.horarios[diaSemana];
  if (!materias) return `📚 Horário de ${diaSemana}: Não registrado.`;
  return `📚 Horário de ${diaSemana}:\n` + materias.split(",").map(m => `- ${m.trim()}`).join("\n");
}

bot.on("message", (msg) => {
  const texto = msg.text?.trim();
  const id = msg.chat.id;
  if (!texto) return;

  if (!dados.usuarios.includes(id)) {
    dados.usuarios.push(id);
    salvarDados();
  }

  const args = texto.split(" ");
  const comando = args.shift().toLowerCase();

  // Ajuste para calcular corretamente o dia atual e o próximo dia
  const hoje = dayjs();
  const amanha = hoje.hour() >= 21 ? hoje.add(1, "day") : hoje; // Muda para o próximo dia após 21h
  const dataHoje = formatarData(hoje);
  const dataAmanha = formatarData(amanha);

  if (comando === "/adicionar") {
    const ultima = args[args.length - 1];
    const data = /^\d{2}\/\d{2}$/.test(ultima) ? ultima : dataHoje;
    const tarefa = args.slice(0, /^\d{2}\/\d{2}$/.test(ultima) ? -1 : undefined).join(" ");

    if (!dados.tarefas[data]) dados.tarefas[data] = [];
    dados.tarefas[data].push(tarefa);
    salvarDados();
    return bot.sendMessage(id, `✅ Tarefa adicionada para ${data}: ${tarefa}`);
  }

  if (comando === "/listar") {
    const qual = args[0];
    let data = dataHoje;
    if (qual === "amanha") data = dataAmanha;
    else if (/^\d{2}\/\d{2}$/.test(qual)) data = qual;
    return bot.sendMessage(id, responderTarefasPara(data));
  }

  if (comando === "/remover") {
    const indice = parseInt(args[0]) - 1;
    const data = args[1];
    if (dados.tarefas[data] && dados.tarefas[data][indice]) {
      const removida = dados.tarefas[data].splice(indice, 1);
      salvarDados();
      return bot.sendMessage(id, `🗑️ Tarefa removida: ${removida}`);
    } else {
      return bot.sendMessage(id, `⚠️ Não encontrei essa tarefa.`);
    }
  }

  if (comando === "/horario") {
    const dia = args[0].toLowerCase();
    const materias = args.slice(1).join(" ");
    dados.horarios[dia] = materias;
    salvarDados();
    return bot.sendMessage(id, `✅ Horário salvo para ${dia}: ${materias}`);
  }

  if (comando === "/listarhorario") {
    const dia = args[0]?.toLowerCase() || hoje.format("dddd").toLowerCase();
    const materias = dados.horarios[dia];
    if (!materias) return bot.sendMessage(id, `📚 Horário de ${dia}: Não registrado.`);
    const resposta = `📚 Horário de ${dia}:\n` + materias.split(",").map(m => `- ${m.trim()}`).join("\n");
    return bot.sendMessage(id, resposta);
  }
});

// Webhook endpoint
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;  // Ajuste para usar a porta configurada no Render
app.listen(port, () => {
  console.log(`✅ Bot rodando com webhook na porta ${port}`);
});
