
const dbName = "quickbooks_mern";
db = db.getSiblingDB(dbName);


db.createCollection("QuickbooksTokens");
db.QuickbooksTokens.createIndex({ companyId: 1 }, { unique: true });


db.createCollection("customers");
db.customers.createIndex({ customerId: 1 }, { unique: true });
db.customers.createIndex({ lastUpdated: -1 });


db.createCollection("invoices");
db.invoices.createIndex({ invoiceId: 1 }, { unique: true });
db.invoices.createIndex({ lastUpdated: -1 });
db.invoices.createIndex({ customerId: 1 });

print("Collections and indexes ensured for " + dbName);
