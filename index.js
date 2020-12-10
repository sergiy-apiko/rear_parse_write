import prompts from "prompts";

import csv from "csv";
import path from "path";
import fs, { write } from "fs";

const dataInput = path.resolve(__dirname, "data/input");

async function main() {
  let isOpen = true;
  while (isOpen) {
    try {
      let fileNames = await fs.readdirSync(dataInput);
      console.log("Welcome");
      let responses = await prompts([
        {
          type: "select",
          name: "rearShaftFile",
          message: "Pick rear shaft file?",
          choices: fileNames.map((el) => ({
            title: el,
            value: el,
          })),
        },
        {
          type: "select",
          name: "productsFile",
          message: "Pick products file?",
          choices: (prev) =>
            fileNames
              .filter((name) => name !== prev)
              .map((el) => ({
                title: el,
                value: el,
              })),
        },
      ]);

      let rearPath = path.resolve(
        __dirname,
        `data/input/${responses.rearShaftFile}`
      );
      let hybridPath = path.resolve(
        __dirname,
        `data/input/${responses.productsFile}`
      );

      let hybridFile = await fs.readFileSync(hybridPath);
      let rearShaftFile = await fs.readFileSync(rearPath);

      let hybridData = await new Promise((resolve, reject) =>
        csv.parse(hybridFile, {}, (err, records) => {
          if (err) reject();
          resolve(records);
        })
      );
      let rearData = await new Promise((resolve, reject) =>
        csv.parse(rearShaftFile, {}, (err, records) => {
          if (err) reject();
          resolve(records);
        })
      );
      let hybridRearIndex = hybridData[0].indexOf("REAR_SHAFT_ADD_ON");
      let hybridSkuIndex = hybridData[0].indexOf("SKU");
      let rearIndex = rearData[0].indexOf("PN");
      rearData.shift();
      let hybridHeaders = hybridData.shift();
      let mappedRear = rearData.map((el) => el[rearIndex]);
      let rowCounter = 0;
      let mappedHybrids = hybridData.map((hybrid) => {
        let rerSearchIndex = mappedRear.indexOf(`${hybrid[hybridSkuIndex]}D`);
        if (rerSearchIndex !== -1) {
          return hybrid.map((el, idx) => {
            if (idx === hybridRearIndex) {
              rowCounter++;
              return mappedRear[rerSearchIndex];
            }
            return el;
          });
        }
        return hybrid;
      });

      let readable = csv.stringify(mappedHybrids, {
        header: true,
        columns: hybridHeaders,
      });
      let result = "";
      let currentChunk;
      var writer = fs.createWriteStream(
        path.resolve(
          __dirname,
          `data/output/${Date.now()}_${responses.productsFile}`
        ),
        {
          flags: "w",
        }
      );

      await new Promise((resolve, reject) => {
        readable.on("readable", () => {
          do {
            currentChunk = readable.read();

            if (currentChunk !== null) {
              writer.write(currentChunk);
              result += currentChunk;
            }
          } while (currentChunk !== null);
        });

        readable.on("end", () => {
          resolve(result);
          console.log("Operation success");
          writer.end();
        });

        readable.on("error", () => {
          writer.end();
          reject();
        });
      });
      let promptAnsw = await prompts({
        type: "select",
        name: "shoulExit",
        message: `Job done!${rowCounter} cells changed`,
        choices: [
          { title: "Retry", value: "retry" },
          { title: "Exit", value: "exit" },
        ],
      });

      if (promptAnsw.shoulExit === "exit") {
        isOpen = false;
        break;
      }
    } catch (error) {
      console.log(error.message);
      let promptAnsw = await prompts({
        type: "select",
        name: "shoulExit",
        message: "Error ocurred!?",
        choices: [
          { title: "Retry", value: "retry" },
          { title: "Exit", value: "exit" },
        ],
      });

      if (promptAnsw.shoulExit === "exit") {
        isOpen = false;
        break;
      }
    }
  }
}

main();
