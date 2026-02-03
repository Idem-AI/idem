import { promptExtra } from "./prompt";

export const cacheFunctionRegister = {
    "redis":resolveRedis
  }

  function resolveRedis(extra:promptExtra){
    let promptArr = [];
    let username = extra.extra['cacheUsername']??"";
    let password = extra.extra['cachePassword']??"root";
    let databaseUrl = extra.extra['cacheUrl']??"localhost:3306";
    promptArr.push(`IMPORTANT: Use Redis for caching. Redis URL is ${databaseUrl}, username is ${username}, password is ${password}. Please write this configuration to the backend.`);
    return promptArr;
  }