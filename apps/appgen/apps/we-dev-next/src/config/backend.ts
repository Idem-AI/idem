import { promptExtra } from "./prompt";

export const backendLanguageFunctionRegister = {
    "java":resolveJava,
    "node":resolveNode,
    "go":resolveGo,
    "python":resolvePython,
  }

  function resolveJava(extra:promptExtra){
    let promptArr = [];
    promptArr.push("IMPORTANT: Build the backend project using Maven, use SpringBoot as the backend framework, use Lombok, and use MyBatis-Plus as the ORM framework. Implement the Controller layer, Service layer, ServiceImpl layer, Mapper layer, and Model layer");
    promptArr.push("IMPORTANT: Remember to create the Application.java file, and use YAML format for SpringBoot configuration");
    return promptArr;
  }
  function resolveNode(extra:promptExtra){
    let promptArr = [];
    promptArr.push("IMPORTANT: Build the backend project using Node.js, use Express as the backend framework. Implement the Controller layer, Service layer, Model layer (including database CRUD Dao layer)");
    promptArr.push("IMPORTANT: Remember to create the index.js file, use .env for Express configuration");
    return promptArr;
  }
  function resolveGo(extra:promptExtra){
    let promptArr = [];
    promptArr.push("IMPORTANT: Build the backend project using Go, use Gin as the backend framework, use GORM as the ORM framework. Implement the Controller layer, Service layer, Model layer, and Mapper layer");
    promptArr.push("IMPORTANT: Remember to create the main.go file, use YAML format for Gin configuration");
    return promptArr;
  }
  function resolvePython(extra:promptExtra){
    let promptArr = [];
    promptArr.push("IMPORTANT: Build the backend project using Python, use FastAPI as the backend framework, use SQLAlchemy as the ORM framework. Implement the Controller layer, Service layer, Model layer, and Mapper layer");
    promptArr.push("IMPORTANT: Remember to create the main.py file, include required packages in requirements.txt, use YAML format for FastAPI configuration");
    return promptArr;
  }
  

  