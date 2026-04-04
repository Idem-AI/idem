<div>
    {{-- Header --}}
    <div class="mb-6 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">
        <h1 class="text-2xl font-bold text-white mb-2">Create a new Service</h1>
        <p class="text-sm text-gray-400">Deploy complex services easily with Docker Compose</p>
    </div>
    
    <form class="flex flex-col gap-4 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50" wire:submit="submit">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Docker Compose</h2>
            <button type="submit" class="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-lg transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Save
            </button>
        </div>
        <x-forms.textarea useMonacoEditor monacoEditorLanguage="yaml" label="Docker Compose file" rows="20"
            id="dockerComposeRaw" autofocus
            placeholder='services:
  ghost:
    documentation: https://ghost.org/docs/config
    image: ghost:5
    volumes:
      - ghost-content-data:/var/lib/ghost/content
    environment:
      - url=$SERVICE_FQDN_GHOST
      - database__client=mysql
      - database__connection__host=mysql
      - database__connection__user=$SERVICE_USER_MYSQL
      - database__connection__password=$SERVICE_PASSWORD_MYSQL
      - database__connection__database=${MYSQL_DATABASE-ghost}
    ports:
      - "2368"
    depends_on:
      - mysql
  mysql:
    documentation: https://hub.docker.com/_/mysql
    image: mysql:8.0
    volumes:
      - ghost-mysql-data:/var/lib/mysql
    environment:
      - MYSQL_USER=${SERVICE_USER_MYSQL}
      - MYSQL_PASSWORD=${SERVICE_PASSWORD_MYSQL}
      - MYSQL_DATABASE=${MYSQL_DATABASE}
      - MYSQL_ROOT_PASSWORD=${SERVICE_PASSWORD_MYSQL_ROOT}
'></x-forms.textarea>
    </form>
</div>
