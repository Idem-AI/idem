<?php

declare(strict_types=1);

namespace Visus\Cuid2;

use Exception;

/**
 * Singleton responsible for generating and storing a fingerprint
 *
 * @internal
 * @psalm-internal Visus\Cuid2
 */
final class Fingerprint
{
    private static ?Fingerprint $instance = null;

    /**
     * @var array<array-key, mixed>
     */
    private readonly array $value;

    /**
     * @throws Exception
     */
    private function __construct()
    {
        $this->value = $this->generateFingerprint();
    }

    /**
     * Gets the current instance.
     *
     * @return Fingerprint
     */
    public static function getInstance(): Fingerprint
    {
        if (is_null(self::$instance)) {
            self::$instance = new Fingerprint();
        }

        return self::$instance;
    }

    /**
     * Gets the value from the instance.
     *
     * @return array<array-key, mixed>
     */
    public function getValue(): array
    {
        return $this->value;
    }

    /**
     * @return array<array-key, mixed>
     * @throws Exception
     */
    private function generateFingerprint(): array
    {
        $identity = !empty(gethostname())
            ? gethostname()
            : substr(str_shuffle('abcdefghjkmnpqrstvwxyz0123456789'), 0, 32);

        $process = (string)getmypid();
        $random = bin2hex(random_bytes(32));

        $hash = hash_init('sha3-512');

        hash_update($hash, $identity);
        hash_update($hash, $process);
        hash_update($hash, $random);

        $result = unpack('C*', hash_final($hash));

        return $result === false ? [] : $result;
    }
}
