# visus/cuid2

[![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/visus-io/php-cuid2/ci.yaml?style=for-the-badge&logo=github)](https://github.com/visus-io/php-cuid2/actions/workflows/ci.yaml)
[![Code Quality](https://img.shields.io/codacy/grade/da334c04546d4d7381eb4e93f4ebdecd?style=for-the-badge&logo=codacy)](https://app.codacy.com/gh/visus-io/php-cuid2/dashboard)
[![Coverage](https://img.shields.io/codacy/coverage/da334c04546d4d7381eb4e93f4ebdecd?style=for-the-badge&logo=codacy)](https://app.codacy.com/gh/visus-io/php-cuid2/coverage/dashboard)

![PHP Version](https://img.shields.io/packagist/dependency-v/visus/cuid2/php?style=for-the-badge)
[![Packagist](https://img.shields.io/packagist/v/visus/cuid2?style=for-the-badge&logo=packagist&logoColor=white&label=stable)](https://packagist.org/packages/visus/cuid2)
![Downloads](https://img.shields.io/packagist/dt/visus/cuid2?style=for-the-badge&logo=packagist&logoColor=white&color=8)
![GitHub](https://img.shields.io/github/license/visus-io/cuid.net?style=for-the-badge)

A PHP implementation of collision-resistant ids. You can read more about CUIDs from the [official project website](https://github.com/paralleldrive/cuid2).

## Getting Started

You can install visus/cuid2 as a [composer package](https://packagist.org/packages/visus/cuid2):

```shell
composer require visus/cuid2
```

## Quick Example

```php
<?php
require_once 'vendor/autoload.php';

// new (default length of 24)
$cuid = new Visus\Cuid2\Cuid2();

// implicit casting
echo $cuid; // hw8kkckkgwkk0oo0gkw0o8sg

// explicit casting
echo $cuid->toString(); // hw8kkckkgwkk0oo0gkw0o8sg

// new (with custom length)
$cuid = new Visus\Cuid2\Cuid2(10);
echo $cuid; // psk8844ck4
```
