<?php

namespace Idem\SharedAuth\Exceptions;

use Exception;

/**
 * Exception pour les erreurs d'authentification et d'autorisation
 */
class AuthException extends Exception
{
    public function __construct(
        string $message = "",
        int $code = 0,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $code, $previous);
    }
}
