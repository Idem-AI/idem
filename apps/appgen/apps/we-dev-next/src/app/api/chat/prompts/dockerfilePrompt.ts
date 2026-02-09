import { ProjectModel } from "../types/project";

/**
 * Generate Dockerfile prompt based on project configuration
 */
export function generateDockerfilePrompt(projectData: ProjectModel): string {
  const configs = projectData.analysisResultModel?.development?.configs;
  
  if (!configs) {
    return "";
  }

  const frontend = configs.frontend;
  const backend = configs.backend;
  const database = configs.database;

  let dockerPrompt = `\n\n## Docker Configuration\n`;
  dockerPrompt += `Generate a production-ready Dockerfile and docker-compose.yml for this project.\n\n`;

  // Frontend Docker instructions
  if (frontend) {
    dockerPrompt += `### Frontend Dockerfile\n`;
    dockerPrompt += `- **Framework**: ${frontend.framework}${frontend.frameworkVersion ? ` v${frontend.frameworkVersion}` : ''}\n`;
    dockerPrompt += `- Use multi-stage build for optimization\n`;
    dockerPrompt += `- Install dependencies in first stage\n`;
    dockerPrompt += `- Build the application\n`;
    dockerPrompt += `- Serve with nginx or appropriate web server\n`;
    dockerPrompt += `- Expose appropriate port (default 80 or 3000)\n\n`;
  }

  // Backend Docker instructions
  if (backend && backend.language) {
    dockerPrompt += `### Backend Dockerfile\n`;
    dockerPrompt += `- **Language**: ${backend.language}\n`;
    dockerPrompt += `- **Framework**: ${backend.framework}\n`;
    
    switch (backend.language.toLowerCase()) {
      case 'node':
      case 'nodejs':
      case 'typescript':
        dockerPrompt += `- Use official Node.js LTS image\n`;
        dockerPrompt += `- Install dependencies with npm/yarn\n`;
        dockerPrompt += `- Copy application files\n`;
        dockerPrompt += `- Expose port 3001 or configured port\n`;
        dockerPrompt += `- Set NODE_ENV=production\n`;
        break;
      case 'python':
        dockerPrompt += `- Use official Python image\n`;
        dockerPrompt += `- Install requirements.txt dependencies\n`;
        dockerPrompt += `- Copy application files\n`;
        dockerPrompt += `- Expose port 8000 or configured port\n`;
        break;
      case 'java':
        dockerPrompt += `- Use official OpenJDK or Maven image\n`;
        dockerPrompt += `- Build with Maven/Gradle\n`;
        dockerPrompt += `- Copy JAR/WAR file\n`;
        dockerPrompt += `- Expose port 8080 or configured port\n`;
        break;
      case 'go':
        dockerPrompt += `- Use official Golang image for build\n`;
        dockerPrompt += `- Use alpine for runtime (multi-stage)\n`;
        dockerPrompt += `- Compile to binary\n`;
        dockerPrompt += `- Expose configured port\n`;
        break;
      default:
        dockerPrompt += `- Use appropriate official image for ${backend.language}\n`;
        dockerPrompt += `- Follow best practices for the language\n`;
    }
    dockerPrompt += `\n`;
  }

  // Database Docker instructions
  if (database && database.provider && database.provider !== 'none') {
    dockerPrompt += `### Database Configuration\n`;
    dockerPrompt += `- **Provider**: ${database.provider}${database.version ? ` v${database.version}` : ''}\n`;
    
    switch (database.provider.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        dockerPrompt += `- Use official PostgreSQL image\n`;
        dockerPrompt += `- Set POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD\n`;
        dockerPrompt += `- Create volume for data persistence\n`;
        dockerPrompt += `- Expose port 5432\n`;
        break;
      case 'mysql':
        dockerPrompt += `- Use official MySQL image\n`;
        dockerPrompt += `- Set MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD\n`;
        dockerPrompt += `- Create volume for data persistence\n`;
        dockerPrompt += `- Expose port 3306\n`;
        break;
      case 'mongodb':
        dockerPrompt += `- Use official MongoDB image\n`;
        dockerPrompt += `- Set MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD\n`;
        dockerPrompt += `- Create volume for data persistence\n`;
        dockerPrompt += `- Expose port 27017\n`;
        break;
      case 'redis':
        dockerPrompt += `- Use official Redis image\n`;
        dockerPrompt += `- Configure password if needed\n`;
        dockerPrompt += `- Create volume for data persistence\n`;
        dockerPrompt += `- Expose port 6379\n`;
        break;
      default:
        dockerPrompt += `- Use official ${database.provider} image\n`;
        dockerPrompt += `- Configure environment variables\n`;
        dockerPrompt += `- Create volume for data persistence\n`;
    }
    dockerPrompt += `\n`;
  }

  // Docker Compose instructions
  dockerPrompt += `### Docker Compose File\n`;
  dockerPrompt += `Create a docker-compose.yml file that:\n`;
  dockerPrompt += `- Defines all services (frontend, backend, database)\n`;
  dockerPrompt += `- Sets up networks for service communication\n`;
  dockerPrompt += `- Configures volumes for data persistence\n`;
  dockerPrompt += `- Uses environment variables from .env file\n`;
  dockerPrompt += `- Implements health checks for services\n`;
  dockerPrompt += `- Sets up proper service dependencies\n`;
  dockerPrompt += `- Configures restart policies\n\n`;

  // Additional Docker best practices
  dockerPrompt += `### Docker Best Practices\n`;
  dockerPrompt += `- Use .dockerignore to exclude unnecessary files\n`;
  dockerPrompt += `- Minimize image layers\n`;
  dockerPrompt += `- Use non-root user for security\n`;
  dockerPrompt += `- Add health checks\n`;
  dockerPrompt += `- Use specific version tags (not 'latest')\n`;
  dockerPrompt += `- Optimize for caching (copy package files first)\n`;
  dockerPrompt += `- Include README with Docker commands\n\n`;

  return dockerPrompt;
}
