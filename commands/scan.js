module.exports = {
  name: 'scan',
  description: 'Force un scan immédiat des nouvelles cartes en vente.',
  async execute(message, args, context) {
    const { checkForNewCards } = context;

    try {
      await checkForNewCards(true, message.channel);
    } catch (error) {
      console.error("❌ Erreur dans la commande !scan :", error);
      message.reply("❌ Une erreur est survenue pendant le scan manuel.");
    }
  }
};
