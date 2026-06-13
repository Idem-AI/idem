<?php

namespace App\Livewire\Project;

use App\Models\Project;
use App\Models\Server;
use App\Support\ValidationPatterns;
use Livewire\Component;
use Visus\Cuid2\Cuid2;

class AddEmpty extends Component
{
    public int $step = 1;

    public string $name = '';

    public string $description = '';

    public string $deployment_type = 'saas';

    public string $deployment_region = '';

    public static function getCountries(): array
    {
        return [
            'africa' => [
                'label' => 'Afrique',
                'countries' => [
                    ['code' => 'CM', 'name' => 'Cameroun',       'city' => 'Douala',   'flag' => '🇨🇲'],
                    ['code' => 'GA', 'name' => 'Gabon',          'city' => 'Libreville','flag' => '🇬🇦'],
                    ['code' => 'CI', 'name' => "Côte d'Ivoire",  'city' => 'Abidjan',  'flag' => '🇨🇮'],
                    ['code' => 'TG', 'name' => 'Togo',           'city' => 'Lomé',     'flag' => '🇹🇬'],
                ],
            ],
            'europe' => [
                'label' => 'Europe & Amérique',
                'countries' => [
                    ['code' => 'DE', 'name' => 'Allemagne',  'city' => 'Francfort', 'flag' => '🇩🇪'],
                    ['code' => 'US', 'name' => 'États-Unis', 'city' => 'New York',  'flag' => '🇺🇸'],
                    ['code' => 'FR', 'name' => 'France',     'city' => 'Paris',     'flag' => '🇫🇷'],
                ],
            ],
        ];
    }

    protected function rules(): array
    {
        $rules = [];

        if ($this->step >= 1) {
            $rules['name'] = ValidationPatterns::nameRules();
            $rules['description'] = ValidationPatterns::descriptionRules();
        }

        if ($this->step === 3) {
            $rules['deployment_region'] = ['required', 'string', 'size:2'];
        }

        return $rules;
    }

    protected function messages(): array
    {
        return array_merge(ValidationPatterns::combinedMessages(), [
            'deployment_region.required' => 'Please select a hosting region.',
        ]);
    }

    public function nextStep()
    {
        if ($this->step === 1) {
            $this->validateOnly('name');
            $this->validateOnly('description');
        }
        $this->step++;
    }

    public function prevStep()
    {
        $this->step = max(1, $this->step - 1);
    }

    public function selectType(string $type)
    {
        $this->deployment_type = $type;
        if ($type === 'saas') {
            $this->step = 3;
        } else {
            $this->createProject();
        }
    }

    public function selectRegion(string $code)
    {
        $this->deployment_region = $code;
    }

    public function submit()
    {
        $this->createProject();
    }

    private function createProject()
    {
        try {
            $this->validate();

            $assignedServerId = null;

            if ($this->deployment_type === 'saas') {
                $assignedServerId = $this->resolveIdemServer($this->deployment_region);
            }

            $project = Project::create([
                'name' => $this->name,
                'description' => $this->description,
                'team_id' => currentTeam()->id,
                'uuid' => (string) new Cuid2,
                'deployment_type' => $this->deployment_type,
                'deployment_region' => $this->deployment_region ?: null,
                'assigned_server_id' => $assignedServerId,
            ]);

            $productionEnvironment = $project->environments()->where('name', 'production')->first();

            return redirect()->route('project.resource.index', [
                'project_uuid' => $project->uuid,
                'environment_uuid' => $productionEnvironment->uuid,
            ]);
        } catch (\Throwable $e) {
            return handleError($e, $this);
        }
    }

    private function resolveIdemServer(?string $countryCode): ?int
    {
        if ($countryCode) {
            $server = Server::where('idem_managed', true)
                ->where('country_code', $countryCode)
                ->whereHas('settings', fn ($q) => $q->where('is_reachable', true)->where('is_usable', true))
                ->orderBy('load_score', 'asc')
                ->first();

            if ($server) {
                return $server->id;
            }
        }

        return Server::where('idem_managed', true)
            ->whereHas('settings', fn ($q) => $q->where('is_reachable', true)->where('is_usable', true))
            ->orderBy('load_score', 'asc')
            ->value('id');
    }

    public function render()
    {
        return view('livewire.project.add-empty', [
            'countries' => self::getCountries(),
        ]);
    }
}
