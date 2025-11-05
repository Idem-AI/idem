{{ Illuminate\Mail\Markdown::parse('---') }}

Thank you,<br>
{{ config('app.name') ?? 'Ideploy' }}

{{ Illuminate\Mail\Markdown::parse('[Contact Support](https://ideploy.io/docs/contact)') }}
