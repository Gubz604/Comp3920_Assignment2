const database = require('../databaseConnection');

async function addReaction(messageId, userId, emojiId) {
    const insertSQL = `
      INSERT INTO emoji_reaction (message_id, user_id, emoji_id)
      VALUES (?, ?, ?)
    `;
    try {
        const [result] = await database.execute(insertSQL, [messageId, userId, emojiId]);
        return result.insertId;
    } catch (err) {
        console.error("Error adding reaction:", err);
        throw err;
    }
}

async function getReactionsByRoom(roomId) {
    const sql = `
      SELECT msg.message_id,
       e.emoji_id,
       e.image,
       e.name,
       COUNT(*) AS total_count
FROM emoji_reaction er
JOIN emoji e ON er.emoji_id = e.emoji_id
JOIN message msg ON er.message_id = msg.message_id
JOIN room_user ru ON msg.room_user_id = ru.room_user_id
WHERE ru.room_id = ?
GROUP BY msg.message_id, e.emoji_id, e.image, e.name

    `;
    try {
        const [rows] = await database.execute(sql, [roomId]);
        return rows; 
    } catch (err) {
        console.error("Error fetching reactions by room:", err);
        return [];
    }
}

module.exports = { addReaction, getReactionsByRoom };