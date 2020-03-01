var receiptsFolder = getOrCreateGdriveFolder("receipts");

var searchMetaItems = [{
  name: "swiggy", query: "swiggy AND receipt AND after:2019/03/31 AND before:2019/09/27",
  costParser: parseSwiggyCost
},{
  name: "ubereats", query: "uber eats AND receipt AND after:2019/03/31 AND before:2019/09/27",
  costParser: parseUbereatsCost
}];

function main() {
  Logger.clear();
  var summaryItems = [];

  searchMetaItems.forEach(function(meta) {
    Logger.log("Attempting search meta: " + JSON.stringify(meta));
    var messages = findMessages(meta);
    Logger.log("Found: " + messages.length + " messages");

    messages.forEach(function(message) {
      var dateStr = Utilities.formatDate(message.getDate(), "IST", "yyyy-MM-dd");
      Logger.log("Attempting to parse and upload message dated: " + dateStr);

      summaryItems.push({
        operator: meta.name,
        date: dateStr,
        cost: !!meta.costParser ? meta.costParser(message.getPlainBody()) : "NA"
      });

      var fileName = meta.name + "_" + dateStr + ".pdf";
      saveAsPdf(receiptsFolder, fileName, message);
      Logger.log("Uploaded: " + receiptsFolder + "/" + fileName);
    });
  });

  createSummarySheet(receiptsFolder, summaryItems);

  Logger.log("Processed " + summaryItems.length + " messages");
}

function getOrCreateGdriveFolder(folderName) {
  var path = folderName.split("/");
  var folders = [DriveApp.getRootFolder()];
  for(i=0; i<path.length; i++) {
    var itr = DriveApp.getFoldersByName(folderName);
    folders[i+1] = itr.hasNext() ? itr.next() : folders[i].createFolder(path[i]);
  }
  return folders[folders.length - 1];
}

function findMessages(meta) {
  var messages = [];
  GmailApp.search(meta.query)
    .forEach(function(thread) {
      thread.getMessages().forEach(function(m) {
        messages.push(m);
      });
  });
  return messages;
}

function saveAsPdf(driveLocation, fileName, message) {
  var blob = Utilities.newBlob(message.getBody(), "text/html");
  driveLocation.createFile(blob.getAs("application/pdf")).setName(fileName);
}

function createSummarySheet(driveLocation, summaryItems) {
  var book = SpreadsheetApp.create("Summary");
  var sheet = book.getActiveSheet();

  sheet.appendRow(["Restaurant/Operator", "Date", "Amount"]);

  summaryItems.forEach(function(summary) {
    Logger.log(summary);
    sheet.appendRow([summary.operator, summary.date, summary.cost]);
  });

  sheet.appendRow(["", "Total", "=SUM(C2:" + "C" + sheet.getLastRow() + ")"]);

  var file = DriveApp.getFileById(book.getId())
  file.makeCopy(file.getName(), driveLocation);

  //Remove file from root
  DriveApp.removeFile(file);
}

function parseSwiggyCost(swiggyMessage) {
  var costRegex = /Grand Total:\s*([0-9.]+)/g;
  costRegex.lastIndex = 0;
  var m = costRegex.exec(swiggyMessage);
  return m && m.length && m.length > 1 ? Number(m[1]) : "NA";
}

function parseUbereatsCost(ubereatsMessage) {
  var costRegex = /Total.*?([0-9.]+)/g;
  costRegex.lastIndex = 0;
  var m = costRegex.exec(ubereatsMessage);
  return m && m.length && m.length > 1 ? Number(m[1]) : "NA";
}
