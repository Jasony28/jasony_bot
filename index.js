
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Chargement de la clé Firebase depuis le fichier JSON local
const serviceAccount = require('./firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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

const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

let knownAuctionIds = new Set();
if (fs.existsSync('known_auctions.json')) {
  const saved = JSON.parse(fs.readFileSync('known_auctions.json'));
  knownAuctionIds = new Set(saved);
}

async function checkForNewCards(isManual = false, replyChannel = null) {
  try {
    const snapshot = await db.collection('auctions').get();
    const newCards = [];

    snapshot.forEach(doc => {
      const id = doc.id;
      const data = doc.data();

      if (!knownAuctionIds.has(id)) {
        knownAuctionIds.add(id);
        newCards.push({ id, ...data });
      }
    });

    if (newCards.length > 0) {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      newCards.forEach(card => {
        const name = card.name || card.cardId || card.id || "Carte inconnue";
        const price = card.price || card.startPrice || 0;
        const msg = `🆕 Nouvelle carte en vente : **${name}** pour ${price} pièces 💰`;
        channel.send(msg);
      });
      fs.writeFileSync('known_auctions.json', JSON.stringify(Array.from(knownAuctionIds)));
      if (isManual && replyChannel) replyChannel.send(`🔎 ${newCards.length} nouvelle(s) carte(s) détectée(s) !`);
    } else if (isManual && replyChannel) {
      replyChannel.send("🔎 Aucune nouvelle carte détectée.");
    }
  } catch (error) {
    console.error("❌ Erreur dans checkForNewCards :", error);
    if (isManual && replyChannel) {
      replyChannel.send("❌ Une erreur est survenue pendant le scan.");
    }
  }
}

client.on('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  checkForNewCards();
  setInterval(checkForNewCards, 5 * 60 * 1000);
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!') || message.author.bot) return;
  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);
  if (!command) return;
  try {
    await command.execute(message, args, { checkForNewCards });
  } catch (error) {
    console.error(error);
    message.reply("❌ Une erreur est survenue pendant l'exécution de la commande.");
  }
});

client.login(process.env.DISCORD_TOKEN);
