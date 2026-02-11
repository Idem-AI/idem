<?php

namespace App\Livewire\Project\Application\Pipeline;

use App\Models\Application;
use App\Models\PipelineConfig;
use App\Models\PipelineTemplate;
use App\Services\Pipeline\ProjectTypeDetector;
use Livewire\Component;

class PipelineWizard extends Component
{
    public $application;
    public $pipelineConfig;
    
    public int $currentStep = 1;
    public const TOTAL_STEPS = 5;
    
    // Step 1: Template Selection
    public ?string $selectedTemplate = null;
    public ?string $detectedTemplate = null;
    
    // Step 2: Trigger Configuration
    public string $triggerMode = 'webhook'; // 'webhook' or 'manual'
    public array $selectedBranches = ['main', 'develop'];
    public string $allBranches = '';
    
    // Step 3: Stages Configuration
    public array $selectedStages = [];
    public array $stageConfigs = [];
    
    // Step 4: Notifications
    public string $notificationMode = 'none'; // 'none', 'all', 'failures'
    public array $notificationChannels = [];
    public array $notificationConfig = [];
    
    // Step 5: Review & Confirm
    public bool $isConfirmed = false;
    
    // UI State
    public bool $isLoading = false;
    public string $errorMessage = '';
    public string $successMessage = '';
    
    public function mount($application_uuid)
    {
        // Load application by UUID
        $this->application = Application::where('uuid', $application_uuid)->firstOrFail();
        $this->pipelineConfig = $this->application->pipelineConfig ?? new PipelineConfig();
        
        // Load existing config if exists
        if ($this->pipelineConfig->exists) {
            $this->loadExistingConfig();
            $this->currentStep = 1; // Start fresh wizard
        } else {
            // Auto-detect template
            $this->detectProjectTemplate();
        }
    }
    
    public function render()
    {
        return view('livewire.project.application.pipeline.wizard', [
            'templates' => PipelineTemplate::where('is_active', true)->get(),
            'currentTemplate' => $this->selectedTemplate ? PipelineTemplate::where('key', $this->selectedTemplate)->first() : null,
            'availableChannels' => $this->getAvailableNotificationChannels(),
        ]);
    }
    
    // ============ STEP 1: Template Selection ============
    
    public function selectTemplate(string $templateKey)
    {
        $this->selectedTemplate = $templateKey;
        $this->loadTemplateDefaults();
        $this->errorMessage = '';
    }
    
    public function detectProjectTemplate()
    {
        $detector = app(ProjectTypeDetector::class);
        $detected = $detector->detect($this->application);
        
        $this->detectedTemplate = $detected;
        $this->selectedTemplate = $detected;
        $this->loadTemplateDefaults();
    }
    
    private function loadTemplateDefaults()
    {
        $template = PipelineTemplate::where('key', $this->selectedTemplate)->first();
        
        if (!$template) {
            $this->errorMessage = 'Template non trouvé';
            return;
        }
        
        // Load default stages from template
        $defaultStages = $template->default_stages ?? [];
        $this->selectedStages = array_keys($defaultStages);
        
        // Initialize stage configs
        foreach ($defaultStages as $stageName => $stageConfig) {
            $this->stageConfigs[$stageName] = $stageConfig;
        }
    }
    
    // ============ STEP 2: Trigger Configuration ============
    
    public function setTriggerMode(string $mode)
    {
        $this->triggerMode = $mode;
    }
    
    public function toggleBranch(string $branch)
    {
        if (in_array($branch, $this->selectedBranches)) {
            $this->selectedBranches = array_filter(
                $this->selectedBranches,
                fn($b) => $b !== $branch
            );
        } else {
            $this->selectedBranches[] = $branch;
        }
    }
    
    public function setCustomBranches(string $branches)
    {
        $this->allBranches = $branches;
        // Parse CSV or space-separated branches
        $this->selectedBranches = array_filter(
            array_map('trim', preg_split('/[,\s]+/', $branches))
        );
    }
    
    // ============ STEP 3: Stages Configuration ============
    
    public function toggleStage(string $stageName)
    {
        if (in_array($stageName, $this->selectedStages)) {
            $this->selectedStages = array_filter(
                $this->selectedStages,
                fn($s) => $s !== $stageName
            );
            unset($this->stageConfigs[$stageName]);
        } else {
            $this->selectedStages[] = $stageName;
            // Load default config for stage
            $template = PipelineTemplate::where('key', $this->selectedTemplate)->first();
            if ($template && isset($template->default_stages[$stageName])) {
                $this->stageConfigs[$stageName] = $template->default_stages[$stageName];
            }
        }
    }
    
    public function updateStageConfig(string $stageName, array $config)
    {
        $this->stageConfigs[$stageName] = array_merge(
            $this->stageConfigs[$stageName] ?? [],
            $config
        );
    }
    
    // ============ STEP 4: Notifications ============
    
    public function setNotificationMode(string $mode)
    {
        $this->notificationMode = $mode;
    }
    
    public function toggleNotificationChannel(string $channel)
    {
        if (in_array($channel, $this->notificationChannels)) {
            $this->notificationChannels = array_filter(
                $this->notificationChannels,
                fn($c) => $c !== $channel
            );
            unset($this->notificationConfig[$channel]);
        } else {
            $this->notificationChannels[] = $channel;
        }
    }
    
    public function updateNotificationConfig(string $channel, array $config)
    {
        $this->notificationConfig[$channel] = array_merge(
            $this->notificationConfig[$channel] ?? [],
            $config
        );
    }
    
    // ============ STEP NAVIGATION ============
    
    public function goToStep(int $step)
    {
        if ($step >= 1 && $step <= self::TOTAL_STEPS) {
            $this->currentStep = $step;
            $this->errorMessage = '';
        }
    }
    
    public function nextStep()
    {
        if (!$this->validateCurrentStep()) {
            return;
        }
        
        if ($this->currentStep < self::TOTAL_STEPS) {
            $this->currentStep++;
        }
    }
    
    public function previousStep()
    {
        if ($this->currentStep > 1) {
            $this->currentStep--;
        }
        $this->errorMessage = '';
    }
    
    // ============ VALIDATION ============
    
    private function validateCurrentStep(): bool
    {
        return match($this->currentStep) {
            1 => $this->validateTemplateSelection(),
            2 => $this->validateTriggerConfig(),
            3 => $this->validateStagesConfig(),
            4 => $this->validateNotifications(),
            5 => $this->validateConfirmation(),
            default => true,
        };
    }
    
    private function validateTemplateSelection(): bool
    {
        if (!$this->selectedTemplate) {
            $this->errorMessage = 'Veuillez sélectionner un template';
            return false;
        }
        return true;
    }
    
    private function validateTriggerConfig(): bool
    {
        if ($this->triggerMode === 'webhook' && empty($this->selectedBranches)) {
            $this->errorMessage = 'Sélectionnez au moins une branche';
            return false;
        }
        return true;
    }
    
    private function validateStagesConfig(): bool
    {
        if (empty($this->selectedStages)) {
            $this->errorMessage = 'Sélectionnez au moins une étape';
            return false;
        }
        return true;
    }
    
    private function validateNotifications(): bool
    {
        if ($this->notificationMode !== 'none' && empty($this->notificationChannels)) {
            $this->errorMessage = 'Sélectionnez au moins un canal de notification';
            return false;
        }
        return true;
    }
    
    private function validateConfirmation(): bool
    {
        return $this->isConfirmed;
    }
    
    // ============ SAVE CONFIGURATION ============
    
    public function savePipeline()
    {
        $this->isLoading = true;
        
        try {
            // Validate final configuration
            if (!$this->validateFinalConfig()) {
                $this->isLoading = false;
                return;
            }
            
            // Prepare trigger config
            $triggerConfig = [
                'mode' => $this->triggerMode,
                'branches' => $this->selectedBranches,
            ];
            
            // Prepare notification config
            $notificationConfig = [
                'mode' => $this->notificationMode,
                'channels' => $this->notificationChannels,
                'settings' => $this->notificationConfig,
            ];
            
            // Update or create PipelineConfig
            $this->pipelineConfig->update([
                'application_id' => $this->application->id,
                'template_key' => $this->selectedTemplate,
                'enabled' => true,
                'stages' => $this->selectedStages,
                'stages_config' => $this->stageConfigs,
                'trigger_config' => $triggerConfig,
                'notification_config' => $notificationConfig,
            ]);
            
            $this->successMessage = '✅ Pipeline configuré avec succès!';
            
            // Dispatch event or redirect
            $this->dispatch('pipeline:saved');
            
        } catch (\Exception $e) {
            $this->errorMessage = 'Erreur: ' . $e->getMessage();
        } finally {
            $this->isLoading = false;
        }
    }
    
    private function validateFinalConfig(): bool
    {
        if (!$this->selectedTemplate) {
            $this->errorMessage = 'Template manquant';
            return false;
        }
        if (empty($this->selectedStages)) {
            $this->errorMessage = 'Aucune étape sélectionnée';
            return false;
        }
        return true;
    }
    
    // ============ HELPERS ============
    
    public function getAvailableNotificationChannels(): array
    {
        return [
            'slack' => ['name' => 'Slack', 'icon' => '💬'],
            'email' => ['name' => 'Email', 'icon' => '📧'],
            'discord' => ['name' => 'Discord', 'icon' => '💬'],
            'telegram' => ['name' => 'Telegram', 'icon' => '📱'],
        ];
    }
    
    public function loadExistingConfig()
    {
        if ($this->pipelineConfig->template_key) {
            $this->selectedTemplate = $this->pipelineConfig->template_key;
        }
        
        if ($this->pipelineConfig->trigger_config) {
            $this->triggerMode = $this->pipelineConfig->trigger_config['mode'] ?? 'webhook';
            $this->selectedBranches = $this->pipelineConfig->trigger_config['branches'] ?? [];
        }
        
        $this->selectedStages = $this->pipelineConfig->stages ?? [];
        $this->stageConfigs = $this->pipelineConfig->stages_config ?? [];
        
        if ($this->pipelineConfig->notification_config) {
            $this->notificationMode = $this->pipelineConfig->notification_config['mode'] ?? 'none';
            $this->notificationChannels = $this->pipelineConfig->notification_config['channels'] ?? [];
            $this->notificationConfig = $this->pipelineConfig->notification_config['settings'] ?? [];
        }
    }
    
    public function getStepProgress(): int
    {
        return round(($this->currentStep / self::TOTAL_STEPS) * 100);
    }
    
    public function getStepTitle(): string
    {
        return match($this->currentStep) {
            1 => '1️⃣ Choisir un template',
            2 => '2️⃣ Configurer les déclencheurs',
            3 => '3️⃣ Sélectionner les étapes',
            4 => '4️⃣ Configurer les notifications',
            5 => '5️⃣ Vérifier & Confirmer',
            default => 'Étape inconnue',
        };
    }
}
