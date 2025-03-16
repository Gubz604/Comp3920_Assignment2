const database = require('../databaseConnection');

async function createGroup(postData) {
    let createGroupSQL = `
        INSERT INTO room
        (name, start_datetime)
        VALUES
        (:name, :start_datetime)
   `;

    let params = {
        name: postData.group_name,  // Ensure this matches database column
        start_datetime: postData.group_start_datetime
    };

    try {
        console.log("Executing createGroup with parameters:", params);

        const [results] = await database.execute(createGroupSQL, params);

        if (results && results.insertId) {
            console.log("Successfully created group with ID:", results.insertId);
            return results.insertId;
        } else {
            console.error("Error: insertId is undefined. Full results:", results);
            return false;
        }
    }
    catch (err) {
        console.error("Error inserting group:", err);
        return false;
    }
}

async function getRoomById(roomId) {
    let getRoomSQL = `SELECT name FROM room WHERE room_id = ?`;

    try {
        console.log(`Fetching room details for room ID: ${roomId}`);
        const [results] = await database.execute(getRoomSQL, [roomId]);
        return results.length > 0 ? results[0] : null;
    } catch (err) {
        console.error("Error fetching room:", err);
        return null;
    }
}

module.exports = { createGroup, getRoomById };
