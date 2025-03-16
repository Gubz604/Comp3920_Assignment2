const database = require('../databaseConnection');

async function getMessagesByRoom(roomId) {
    let getMessagesSQL = `
        SELECT m.message_id, m.text, m.sent_datetime, u.username
        FROM message m
        JOIN room_user ru ON m.room_user_id = ru.room_user_id
        JOIN user u ON ru.user_id = u.user_id
        WHERE ru.room_id = ?
        ORDER BY m.sent_datetime ASC;
    `;

    try {
        // console.log("Fetching messages for room:", roomId);
        const [results] = await database.execute(getMessagesSQL, [roomId]);
        // console.log("Messages retrieved:", results);
        return results;
    } catch (err) {
        console.error("Error fetching messages:", err);
        return [];
    }
}

async function sendMessage(roomId, username, content) {
    let getRoomUserIdSQL = `
        SELECT room_user_id FROM room_user
        JOIN user ON room_user.user_id = user.user_id
        WHERE room_user.room_id = ? AND user.username = ?;
    `;

    let insertMessageSQL = `
        INSERT INTO message (room_user_id, sent_datetime, text)
        VALUES (?, NOW(), ?);
    `;

    try {
        // 🔍 Find the `room_user_id` for this user
        const [roomUserResults] = await database.execute(getRoomUserIdSQL, [roomId, username]);
        if (roomUserResults.length === 0) {
            throw new Error("User is not part of this room.");
        }

        const roomUserId = roomUserResults[0].room_user_id;

        // 🔥 Insert message into `message` table
        await database.execute(insertMessageSQL, [roomUserId, content]);

        console.log("Message sent successfully.");
    } catch (err) {
        console.error("Error inserting message:", err);
        throw err;
    }
}



module.exports = { getMessagesByRoom, sendMessage };