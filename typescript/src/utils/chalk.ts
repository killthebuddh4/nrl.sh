/* eslint-disable no-console */
import chalk from "chalk";

export const local = {
  blue: (str: string) => console.log(chalk.blue(str)),
  green: (str: string) => console.log(chalk.green(str)),
  red: (str: string) => console.log(chalk.red(str)),
  yellow: (str: string) => console.log(chalk.yellow(str)),
};
