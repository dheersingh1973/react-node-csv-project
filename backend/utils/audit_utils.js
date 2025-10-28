const { getConnections } = require('../db'); // Import getConnections from db.js

async function insertAuditTrail(transaction_id, table_name, entity_id, field_name, old_value, new_value, action, changed_by) {
    try {
        const { localConnection } = getConnections(); // Get the localConnection promise
        if (!localConnection) {
            console.error('Local database connection not established. Cannot insert audit trail entry.');
            return;
        }
        await localConnection.query(
            `INSERT INTO audit_trail (transaction_id, table_name, entity_id, field_name, old_value, new_value, action, changed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [transaction_id, table_name, entity_id, field_name, old_value, new_value, action, changed_by]
        );
        console.log(`Audit trail entry created for ${table_name}:${entity_id}, action: ${action}`);
    } catch (error) {
        console.error('Error inserting into audit_trail:', error);
    }
}

module.exports = {
    insertAuditTrail
};
