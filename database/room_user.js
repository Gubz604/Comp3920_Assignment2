const database = require('../databaseConnection');

async function addUsersToRoom(roomId, userIds) {
    if (!roomId || !userIds || userIds.length === 0) {
        throw new Error("Invalid roomId or userIds");
    }

    let createGroupUsersSQL = `
        INSERT INTO room_user (user_id, room_id)
        VALUES ${userIds.map(() => "(?, ?)").join(", ")}
    `;

    let params = userIds.flatMap(userId => [userId, roomId]); // Use correct user IDs

    try {
        const [results] = await database.execute(createGroupUsersSQL, params);
        console.log(`Successfully added ${results.affectedRows} users to room ${roomId}`);
        return userIds;
    }
    catch (err) {
        console.error("Error inserting users into room_user:", err);
        throw err;
    }
}

async function getUserGroups(username) {
    let getGroupsSQL = `
        SELECT r.room_id, r.name 
        FROM room r
        JOIN room_user ru ON r.room_id = ru.room_id
        JOIN user u ON ru.user_id = u.user_id
        WHERE u.username = :username;
    `;

    try {
        const [results] = await database.execute(getGroupsSQL, { username });
        return results.length > 0 ? results : [];
    }
    catch (err) {
        console.error("Error fetching user groups:", err);
        return [];
    }
}

async function getUserGroupsWithMessages(username) {
    let sql = `
SELECT 
    r.room_id, 
    r.name AS room_name,
    (
      SELECT MAX(m2.sent_datetime)
      FROM message m2
      JOIN room_user ru2 ON m2.room_user_id = ru2.room_user_id
      WHERE ru2.room_id = r.room_id
    ) AS last_message_time,
    COUNT(m_all.message_id) AS unread_messages
FROM room r
JOIN room_user ru ON r.room_id = ru.room_id
JOIN user u ON ru.user_id = u.user_id
LEFT JOIN (
    SELECT m.message_id, ru2.room_id
    FROM message m
    JOIN room_user ru2 ON m.room_user_id = ru2.room_user_id
) AS m_all ON m_all.room_id = r.room_id
    AND (ru.last_read_message IS NULL OR m_all.message_id > ru.last_read_message)
WHERE u.username = ?
GROUP BY r.room_id, r.name, ru.room_id, ru.user_id;
    `;

    try {
        // console.log("Fetching user groups with last message timestamp and unread count:", username);
        const [results] = await database.execute(sql, [username]);
        // console.log("User groups with message data:", results);
        return results;
    } catch (err) {
        console.error("Error fetching user groups with messages:", err);
        return [];
    }
}

async function updateLastReadMessage(username, roomId) {
    try {
        // Step 1: Get the latest message ID for the room
        const selectSQL = `
            SELECT MAX(m.message_id) AS maxMessageId
            FROM message m
            JOIN room_user ru ON m.room_user_id = ru.room_user_id
            WHERE ru.room_id = ?
        `;
        const [rows] = await database.execute(selectSQL, [roomId]);
        const maxMessageId = rows[0].maxMessageId;
        if (!maxMessageId) {
            console.log("No messages found to mark as read.");
            return;
        }

        // Step 2: Update the user's last_read_message with the latest message ID
        const updateSQL = `
            UPDATE room_user ru
            JOIN user u ON ru.user_id = u.user_id
            SET ru.last_read_message = ?
            WHERE u.username = ? AND ru.room_id = ?;
        `;
        await database.execute(updateSQL, [maxMessageId, username, roomId]);
        console.log(`✅ last_read_message updated to ${maxMessageId} for ${username} in room ${roomId}`);
    } catch (err) {
        console.error("❌ Error updating last_read_message:", err);
    }
}

async function getRoomMembers(roomId) {
    const sql = `
      SELECT u.user_id, u.username
      FROM room_user ru
      JOIN user u ON ru.user_id = u.user_id
      WHERE ru.room_id = ?
    `;
    const [rows] = await database.execute(sql, [roomId]);
    return rows;
}


module.exports = { addUsersToRoom, getUserGroups, getUserGroupsWithMessages, updateLastReadMessage, getRoomMembers };