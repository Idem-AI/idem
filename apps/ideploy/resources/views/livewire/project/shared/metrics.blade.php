<div>
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <h2 class="text-2xl font-bold text-light mb-2">
            <span class="i-underline">Metrics</span>
        </h2>
        <p class="text-sm text-light opacity-70">Basic metrics for your application container.</p>
    </div>

    <div class="flex flex-col gap-6">
        @if ($resource->getMorphClass() === 'App\Models\Application' && $resource->build_pack === 'dockercompose')
            <div class="glass-card p-4 bg-warning/10">
                <div class="flex items-start gap-3 text-warning">
                    <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <p class="text-sm">Metrics are not available for Docker Compose applications yet!</p>
                </div>
            </div>
        @elseif(!$resource->destination->server->isMetricsEnabled())
            <div class="glass-card p-4 bg-warning/10">
                <div class="flex items-start gap-3 text-warning">
                    <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <div class="text-sm">
                        <p class="mb-1">Metrics are only available for servers with Sentinel & Metrics enabled!</p>
                        <p>Go to <a class="underline text-accent" href="{{ route('server.show', $resource->destination->server->uuid) }}">Server settings</a> to enable it.</p>
                    </div>
                </div>
            </div>
        @else
            @if (!str($resource->status)->contains('running'))
                <div class="glass-card p-4 bg-warning/10">
                    <div class="flex items-start gap-3 text-warning">
                        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        <p class="text-sm">Metrics are only available when the application container is running!</p>
                    </div>
                </div>
            @else
                {{-- Metrics Configuration --}}
                <div class="glass-card p-6 mb-6">
                    <h3 class="text-lg font-semibold text-accent mb-4">Configuration</h3>
                    <x-forms.select label="Interval" wire:change="setInterval" id="interval">
                <option value="5">5 minutes (live)</option>
                <option value="10">10 minutes (live)</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="720">12 hours</option>
                <option value="10080">1 week</option>
                <option value="43200">30 days</option>
                    </x-forms.select>
                </div>

                {{-- Charts Section --}}
                <div @if ($poll) wire:poll.5000ms='pollData' @endif x-init="$wire.loadData()">
                    {{-- CPU Chart --}}
                    <div class="glass-card p-6 mb-6">
                        <h3 class="text-lg font-semibold text-accent mb-4">CPU Usage</h3>
                        <div wire:ignore id="{!! $chartId !!}-cpu"></div>

                <script>
                    checkTheme();
                    const optionsServerCpu = {
                        stroke: {
                            curve: 'straight',
                            width: 2,
                        },
                        chart: {
                            height: '150px',
                            id: '{!! $chartId !!}-cpu',
                            type: 'area',
                            toolbar: {
                                show: true,
                                tools: {
                                    download: false,
                                    selection: false,
                                    zoom: true,
                                    zoomin: false,
                                    zoomout: false,
                                    pan: false,
                                    reset: true
                                },
                            },
                            animations: {
                                enabled: true,
                            },
                        },
                        fill: {
                            type: 'gradient',
                        },
                        dataLabels: {
                            enabled: false,
                            offsetY: -10,
                            style: {
                                colors: ['#FCD452'],
                            },
                            background: {
                                enabled: false,
                            }
                        },
                         grid: {
                             show: true,
                             borderColor: '',
                         },
                         colors: [cpuColor],
                         xaxis: {
                             type: 'datetime',
                         },
                          series: [{
                              name: "CPU %",
                             data: []
                         }],
                         noData: {
                             text: 'Loading...',
                             style: {
                                 color: textColor,
                             }
                         },
                         tooltip: {
                             enabled: true,
                             marker: {
                                 show: false,
                             },
                             custom: function({ series, seriesIndex, dataPointIndex, w }) {
                                 const value = series[seriesIndex][dataPointIndex];
                                 const timestamp = w.globals.seriesX[seriesIndex][dataPointIndex];
                                 const date = new Date(timestamp);
                                 const timeString = String(date.getUTCHours()).padStart(2, '0') + ':' +
                                     String(date.getUTCMinutes()).padStart(2, '0') + ':' +
                                     String(date.getUTCSeconds()).padStart(2, '0') + ', ' +
                                     date.getUTCFullYear() + '-' +
                                     String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
                                     String(date.getUTCDate()).padStart(2, '0');
                                 return '<div class="apexcharts-tooltip-custom">' +
                                     '<div class="apexcharts-tooltip-custom-value">CPU: <span class="apexcharts-tooltip-value-bold">' + value + '%</span></div>' +
                                     '<div class="apexcharts-tooltip-custom-title">' + timeString + '</div>' +
                                     '</div>';
                             }
                         },
                         legend: {
                             show: false
                         }
                    }
                     const serverCpuChart = new ApexCharts(document.getElementById(`{!! $chartId !!}-cpu`), optionsServerCpu);
                     serverCpuChart.render();
                     Livewire.on('refreshChartData-{!! $chartId !!}-cpu', (chartData) => {
                         checkTheme();
                          serverCpuChart.updateOptions({
                              series: [{
                                  data: chartData[0].seriesData,
                              }],
                              colors: [cpuColor],
                             xaxis: {
                                 type: 'datetime',
                                 labels: {
                                     show: true,
                                     style: {
                                         colors: textColor,
                                     }
                                 }
                             },
                              yaxis: {
                                  show: true,
                                  labels: {
                                      show: true,
                                      style: {
                                          colors: textColor,
                                      },
                                      formatter: function(value) {
                                          return Math.round(value) + ' %';
                                      }
                                  }
                              },
                             noData: {
                                 text: 'Loading...',
                                 style: {
                                     color: textColor,
                                 }
                             }
                         });
                     });
                </script>
                    </div>

                    {{-- Memory Chart --}}
                    <div class="glass-card p-6">
                        <h3 class="text-lg font-semibold text-accent mb-4">Memory Usage</h3>
                        <div wire:ignore id="{!! $chartId !!}-memory"></div>

                <script>
                    checkTheme();
                    const optionsServerMemory = {
                        stroke: {
                            curve: 'straight',
                            width: 2,
                        },
                        chart: {
                            height: '150px',
                            id: '{!! $chartId !!}-memory',
                            type: 'area',
                            toolbar: {
                                show: true,
                                tools: {
                                    download: false,
                                    selection: false,
                                    zoom: true,
                                    zoomin: false,
                                    zoomout: false,
                                    pan: false,
                                    reset: true
                                },
                            },
                            animations: {
                                enabled: true,
                            },
                        },
                        fill: {
                            type: 'gradient',
                        },
                        dataLabels: {
                            enabled: false,
                            offsetY: -10,
                            style: {
                                colors: ['#FCD452'],
                            },
                            background: {
                                enabled: false,
                            }
                        },
                         grid: {
                             show: true,
                             borderColor: '',
                         },
                         colors: [ramColor],
                         xaxis: {
                             type: 'datetime',
                             labels: {
                                 show: true,
                                 style: {
                                     colors: textColor,
                                 }
                             }
                         },
                         series: [{
                             name: "Memory (MB)",
                             data: []
                         }],
                         noData: {
                             text: 'Loading...',
                             style: {
                                 color: textColor,
                             }
                         },
                         tooltip: {
                             enabled: true,
                             marker: {
                                 show: false,
                             },
                             custom: function({ series, seriesIndex, dataPointIndex, w }) {
                                 const value = series[seriesIndex][dataPointIndex];
                                 const timestamp = w.globals.seriesX[seriesIndex][dataPointIndex];
                                 const date = new Date(timestamp);
                                 const timeString = String(date.getUTCHours()).padStart(2, '0') + ':' +
                                     String(date.getUTCMinutes()).padStart(2, '0') + ':' +
                                     String(date.getUTCSeconds()).padStart(2, '0') + ', ' +
                                     date.getUTCFullYear() + '-' +
                                     String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
                                     String(date.getUTCDate()).padStart(2, '0');
                                 return '<div class="apexcharts-tooltip-custom">' +
                                     '<div class="apexcharts-tooltip-custom-value">Memory: <span class="apexcharts-tooltip-value-bold">' + value + ' MB</span></div>' +
                                     '<div class="apexcharts-tooltip-custom-title">' + timeString + '</div>' +
                                     '</div>';
                             }
                         },
                         legend: {
                             show: false
                         }
                    }
                     const serverMemoryChart = new ApexCharts(document.getElementById(`{!! $chartId !!}-memory`),
                         optionsServerMemory);
                     serverMemoryChart.render();
                     Livewire.on('refreshChartData-{!! $chartId !!}-memory', (chartData) => {
                         checkTheme();
                          serverMemoryChart.updateOptions({
                              series: [{
                                  data: chartData[0].seriesData,
                              }],
                              colors: [ramColor],
                             xaxis: {
                                 type: 'datetime',
                                 labels: {
                                     show: true,
                                     style: {
                                         colors: textColor,
                                     }
                                 }
                             },
                              yaxis: {
                                  min: 0,
                                  show: true,
                                  labels: {
                                      show: true,
                                      style: {
                                          colors: textColor,
                                      },
                                      formatter: function(value) {
                                          return Math.round(value) + ' MB';
                                      }
                                  }
                              },
                             noData: {
                                 text: 'Loading...',
                                 style: {
                                     color: textColor,
                                 }
                             }
                         });
                     });
                </script>
                    </div>
                </div>
            @endif
        @endif
    </div>
</div>
