require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const admin = require('firebase-admin');

// 🔐 Lire la variable d'environnement contenant la clé Firebase
const firebaseConfig = JSON.parse(process.env.FIREBASE_KEY_JSON);

// 🔐 Initialiser Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig)
});

const db = admin.firestore();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.name, command);
}

let knownAuctionIds = new Set();

async function checkForNewCards(force = false, overrideChannel = null) {
  try {
    const snapshot = await db.collection('auctions').get();
    const newCards = [];

    snapshot.forEach(doc => {
      if (!knownAuctionIds.has(doc.id)) {
        knownAuctionIds.add(doc.id);
        newCards.push(doc.data());
      }
    });

    const channel = overrideChannel || await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);

    if (newCards.length > 0) {
      for (const card of newCards) {
        channel.send(`🆕 Nouvelle carte en vente : **${card.name || 'Nom inconnu'}** pour ${card.price || '??'} pièces 💰`);
      }
    } else if (force) {
      channel.send("🔎 Aucune nouvelle carte détectée.");
    }
  } catch (error) {
    console.error("❌ Erreur dans checkForNewCards :", error);
  }
}

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  checkForNewCards();
  setInterval(checkForNewCards, 5 * 60 * 1000); // Toutes les 5 minutes
});

client.on('messageCreate', async message => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const args = message.content.slice(1).split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);

  if (!command) return;

  try {
    await command.execute(message, args, { checkForNewCards });
  } catch (error) {
    console.error(error);
    message.reply("❌ Une erreur s'est produite lors de l'exécution de la commande.");
  }
});

client.login(process.env.DISCORD_TOKEN);
