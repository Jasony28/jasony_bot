module.exports = {
    name: 'ping',
    description: 'Répond Pong !',
    execute(message, args) {
        message.channel.send('Pong !');
    },
};
