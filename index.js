const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const config = require('./config.json');
const { toZonedTime, fromZonedTime, format } = require('date-fns-tz');
const { startOfDay, addDays, isSunday, isSaturday } = require('date-fns');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TIMEZONE = 'America/Sao_Paulo';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; 

const START_DATE = new Date(config.startDate);
const TEAMS = config.teams.map(team => team.map(id => BigInt(id)));
const NOTIFY_CHANNEL_ID = BigInt(config.channelId);

const HOLIDAYS = [
  '2025-12-25',
  '2026-01-01',
  '2026-02-16', 
  '2026-02-17', 
  '2026-02-18', 
  '2026-04-03', 
  '2026-04-21',
  '2026-05-01',
  '2026-06-04', 
  '2026-09-07',
  '2026-10-12',
  '2026-11-02',
  '2026-11-15',
  '2026-11-20',
  '2026-12-25',
  '2027-01-01',
  '2027-02-08',
  '2027-02-09', 
  '2027-02-10', 
  '2027-03-26', 
  '2027-04-21',
  '2027-05-01',
  '2027-05-27',
  '2027-09-07',
  '2027-10-12',
  '2027-11-02',
  '2027-11-15',
  '2027-11-20',
  '2027-12-25',
  '2028-01-01',
  '2028-02-28',
  '2028-02-29', 
  '2028-03-01',
  '2028-04-14', 
  '2028-04-21',
  '2028-05-01',
  '2028-06-15', 
  '2028-09-07',
  '2028-10-12',
  '2028-11-02',
  '2028-11-15',
  '2028-11-20',
  '2028-12-25',
  '2029-01-01',
  '2029-02-12', 
  '2029-02-13',
  '2029-02-14', 
  '2029-03-30', 
  '2029-04-21',
  '2029-05-01',
  '2029-05-31', 
  '2029-09-07',
  '2029-10-12',
  '2029-11-02',
  '2029-11-15',
  '2029-11-20',
  '2029-12-25',
];

app.get('/', (req, res) => {
  res.send('🤖 Bot de Code Review online e funcionando! 🚀');
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT} para manter o Render acordado`);
});

function getTodayInBrazil() {
  return toZonedTime(new Date(), TIMEZONE);
}

function getDateInBrazil(date) {
  return toZonedTime(date, TIMEZONE);
}

function formatBrazil(date, fmt = 'yyyy-MM-dd') {
  return format(date, fmt, { timeZone: TIMEZONE });
}

function isHoliday(date) {
  const zonedDate = getDateInBrazil(date);
  const dateStr = formatBrazil(zonedDate, 'yyyy-MM-dd');
  return HOLIDAYS.includes(dateStr);
}

function isWorkday(date) {
  const zonedDate = getDateInBrazil(date);
  return !isSaturday(zonedDate) && !isSunday(zonedDate) && !isHoliday(zonedDate);
}

function countWorkdaysSinceStart() {
  let count = 0;
  let current = new Date(START_DATE);
  const today = startOfDay(getTodayInBrazil());

  let currentZoned = startOfDay(getDateInBrazil(current));

  while (currentZoned <= today) {
    if (isWorkday(current)) count++;
    current = addDays(current, 1);
    currentZoned = startOfDay(getDateInBrazil(current));
  }
  return count;
}

function getCurrentTeam() {
  const workdayCount = countWorkdaysSinceStart();
  if (workdayCount === 0) return TEAMS[0];
  const index = Math.floor((workdayCount - 1) / 2) % TEAMS.length;
  return TEAMS[index];
}

function isFirstDayOfTeam() {
  const workdayCount = countWorkdaysSinceStart();
  return workdayCount > 0 && workdayCount % 2 === 1;
}

async function notifyIfNeeded(forceToday = false) {
  const todayBrazil = getTodayInBrazil();
  const todayStart = startOfDay(todayBrazil);

  const shouldNotify = forceToday || (isWorkday(todayBrazil) && isFirstDayOfTeam());

  if (!shouldNotify) return;

  const team = getCurrentTeam();
  const channel = client.channels.cache.get(NOTIFY_CHANNEL_ID.toString());

  if (!channel || channel.type !== ChannelType.GuildText) {
    console.log('❌ Canal de notificação não encontrado ou inválido!');
    return;
  }

  try {
    const title = forceToday ? '👥 **CODE REVIEW ATUAL**' : '🔄 **TROCA DE CODE REVIEW!**';
    const text = forceToday ? 'estão responsáveis hoje e amanhã' : 'estão responsáveis pelos próximos 2 dias úteis';
    const dateStr = formatBrazil(todayBrazil, 'dd/MM/yyyy');

    await channel.send({
      content: `${title}\n**A partir de hoje (${dateStr}):**\n<@${team[0]}> e <@${team[1]}> ${text}!\nBoa revisão, dupla! 🚀`
    });
    console.log(`✅ Mensagem enviada: ${forceToday ? 'dupla atual (início do bot)' : 'troca automática'}`);
  } catch (error) {
    console.error('Erro ao enviar mensagem automática:', error);
  }
}

client.once('clientReady', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);

  const commands = [
    {
      name: 'reviewers',
      description: 'Mostra quem está de code review hoje',
    }
  ];

  try {
    const guild = await client.guilds.fetch(config.guildId);
    await guild.commands.set(commands);
    console.log('✅ Comando /reviewers registrado no servidor!');
  } catch (error) {
    console.error('Erro ao registrar no servidor, tentando global:', error);
    await client.application.commands.set(commands);
    console.log('Comando /reviewers registrado globalmente (pode demorar até 1h)');
  }

  notifyIfNeeded(true);

  setInterval(() => notifyIfNeeded(false), 24 * 60 * 60 * 1000);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'reviewers') {
    const team = getCurrentTeam();
    const todayStr = formatBrazil(getTodayInBrazil(), 'dd/MM/yyyy');

    await interaction.reply({
      content: `**Responsáveis pelo code review hoje (${todayStr}):**\n<@${team[0]}> e <@${team[1]}>\nBoa revisão! 🚀`,
      ephemeral: false
    });
  }
});

client.login(config.token);