// Note: This import path may need adjustment based on actual project structure
// For now, defining the interface locally to avoid import issues
interface ProjectModel {
  id?: string;
  name: string;
  description: string;
  type: 'web' | 'mobile' | 'iot' | 'desktop';
  analysisResultModel?: {
    development?: {
      configs?: {
        database?: {
          provider: string;
          version?: string;
          orm?: string;
          ormVersion?: string;
          features?: string[] | Record<string, boolean>;
        };
      };
    };
  };
}

export const databaseeFunctionRegister = {
    "mysql": resolveMySql,
    "postgresql": resolvePostgreSQL,
    "mongodb": resolveMongoDB,
    "sqlite": resolveSQLite
  }

  function resolveMySql(project: ProjectModel) {
    const promptArr = [];
    const databaseConfig = project.analysisResultModel?.development?.configs?.database;
    
    if (!databaseConfig || databaseConfig.provider !== 'mysql') {
      return [];
    }
    
    promptArr.push("IMPORTANT: Based on the frontend code, place SQL files in the SQL folder, implement SQL statements, write database creation and table creation statements, and include some sample data to be inserted into the database");
    promptArr.push(`IMPORTANT: Use MySQL as the database (${databaseConfig.version || 'latest'}), configure connection in backend with appropriate settings.`);
    
    if (databaseConfig.orm) {
      promptArr.push(`IMPORTANT: Use ${databaseConfig.orm} ${databaseConfig.ormVersion || ''} as ORM for database operations.`);
    }
    
    // Add database features
    const features = databaseConfig.features;
    if (features) {
      if (Array.isArray(features)) {
        features.forEach(feature => {
          promptArr.push(`IMPORTANT: Implement ${feature} functionality in the database layer.`);
        });
      } else {
        Object.entries(features).forEach(([feature, enabled]) => {
          if (enabled) {
            promptArr.push(`IMPORTANT: Implement ${feature} functionality in the database layer.`);
          }
        });
      }
    }
    
    return promptArr;
  }

  function resolvePostgreSQL(project: ProjectModel) {
    const promptArr = [];
    const databaseConfig = project.analysisResultModel?.development?.configs?.database;
    
    if (!databaseConfig || databaseConfig.provider !== 'postgresql') {
      return [];
    }
    
    promptArr.push("IMPORTANT: Based on the frontend code, place SQL files in the SQL folder, implement SQL statements, write database creation and table creation statements, and include some sample data to be inserted into the database");
    promptArr.push(`IMPORTANT: Use PostgreSQL as the database (${databaseConfig.version || 'latest'}), configure connection in backend with appropriate settings.`);
    
    if (databaseConfig.orm) {
      promptArr.push(`IMPORTANT: Use ${databaseConfig.orm} ${databaseConfig.ormVersion || ''} as ORM for database operations.`);
    }
    
    return promptArr;
  }

  function resolveMongoDB(project: ProjectModel) {
    const promptArr = [];
    const databaseConfig = project.analysisResultModel?.development?.configs?.database;
    
    if (!databaseConfig || databaseConfig.provider !== 'mongodb') {
      return [];
    }
    
    promptArr.push("IMPORTANT: Use MongoDB as the database, create appropriate collections and document schemas.");
    promptArr.push(`IMPORTANT: Configure MongoDB connection (${databaseConfig.version || 'latest'}) in backend with appropriate settings.`);
    
    if (databaseConfig.orm) {
      promptArr.push(`IMPORTANT: Use ${databaseConfig.orm} ${databaseConfig.ormVersion || ''} as ODM for database operations.`);
    }
    
    return promptArr;
  }

  function resolveSQLite(project: ProjectModel) {
    const promptArr = [];
    const databaseConfig = project.analysisResultModel?.development?.configs?.database;
    
    if (!databaseConfig || databaseConfig.provider !== 'sqlite') {
      return [];
    }
    
    promptArr.push("IMPORTANT: Use SQLite as the database, create database file and tables with appropriate schema.");
    promptArr.push(`IMPORTANT: Configure SQLite connection in backend with file-based storage.`);
    
    if (databaseConfig.orm) {
      promptArr.push(`IMPORTANT: Use ${databaseConfig.orm} ${databaseConfig.ormVersion || ''} as ORM for database operations.`);
    }
    
    return promptArr;
  }