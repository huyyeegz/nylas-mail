const {DatabaseTypes: {JSONARRAYType}} = require('isomorphic-core');

module.exports = (sequelize, Sequelize) => {
  return sequelize.define('thread', {
    id: { type: Sequelize.STRING(65), primaryKey: true },
    accountId: { type: Sequelize.STRING, allowNull: false },
    version: Sequelize.INTEGER,
    remoteThreadId: Sequelize.STRING,
    subject: Sequelize.STRING(500),
    snippet: Sequelize.STRING(255),
    unreadCount: Sequelize.INTEGER,
    starredCount: Sequelize.INTEGER,
    firstMessageDate: Sequelize.DATE,
    lastMessageDate: Sequelize.DATE,
    lastMessageReceivedDate: Sequelize.DATE,
    lastMessageSentDate: Sequelize.DATE,
    participants: JSONARRAYType('participants'),
  }, {
    indexes: [
      { fields: ['subject'] },
      { fields: ['remoteThreadId'] },
    ],
    classMethods: {
      requiredAssociationsForJSON: ({Folder, Label, Message}) => {
        return [
          {model: Folder},
          {model: Label},
          {
            model: Message,
            attributes: ['id'],
          },
        ]
      },
      associate: ({Thread, Folder, ThreadFolder, Label, ThreadLabel, Message}) => {
        Thread.belongsToMany(Folder, {through: ThreadFolder})
        Thread.belongsToMany(Label, {through: ThreadLabel})
        Thread.hasMany(Message)
      },
    },
    instanceMethods: {
      async updateLabelsAndFolders() {
        const messages = await this.getMessages();
        const labelIds = new Set()
        const folderIds = new Set()

        await Promise.all(messages.map(async (msg) => {
          const labels = await msg.getLabels({attributes: ['id']})
          labels.forEach(({id}) => labelIds.add(id));
          folderIds.add(msg.folderId)
        }));

        await Promise.all([
          this.setLabels(Array.from(labelIds)),
          this.setFolders(Array.from(folderIds)),
        ]);

        return this.save();
      },

      toJSON() {
        if (!(this.labels instanceof Array)) {
          throw new Error("Thread.toJSON called on a thread where labels were not eagerly loaded.")
        }
        if (!(this.folders instanceof Array)) {
          throw new Error("Thread.toJSON called on a thread where folders were not eagerly loaded.")
        }
        if (!(this.messages instanceof Array)) {
          throw new Error("Thread.toJSON called on a thread where messages were not eagerly loaded. (Only need the IDs!)")
        }

        const response = {
          id: `${this.id}`,
          object: 'thread',
          folders: this.folders,
          labels: this.labels,
          account_id: this.accountId,
          participants: this.participants,
          subject: this.subject,
          snippet: this.snippet,
          unread: this.unreadCount > 0,
          starred: this.starredCount > 0,
          last_message_timestamp: this.lastMessageDate ? this.lastMessageDate.getTime() / 1000.0 : null,
          last_message_sent_timestamp: this.lastMessageSentDate ? this.lastMessageSentDate.getTime() / 1000.0 : null,
          last_message_received_timestamp: this.lastMessageReceivedDate ? this.lastMessageReceivedDate.getTime() / 1000.0 : null,
        };

        const expanded = this.messages[0] ? !!this.messages[0].accountId : false;
        if (expanded) {
          response.messages = this.messages;
        } else {
          response.message_ids = this.messages.map(m => m.id);
        }

        return response;
      },
    },
  });
};
