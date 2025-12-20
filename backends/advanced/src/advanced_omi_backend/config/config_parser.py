"""
Config Parser - Simple YAML-based configuration management.
"""

from pathlib import Path
from typing import Optional
from ruamel.yaml import YAML

from .config_schema import ChronicleConfig

yaml = YAML()


class ConfigParser:
    """Simple configuration parser for config.yaml using ruamel.yaml."""

    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = Path(config_path)

    async def load(self) -> ChronicleConfig:
        """Load and validate configuration from YAML file."""
        if not self.config_path.exists():
            return ChronicleConfig()

        with open(self.config_path) as f:
            data = yaml.load(f) or {}
        return ChronicleConfig(**data)

    async def save(self, config: ChronicleConfig) -> None:
        """Save configuration to YAML file."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)

        with open(self.config_path, 'w') as f:
            yaml.dump(config.model_dump(mode='json'), f)

    async def update(self, updates: dict, updated_by: str = "user") -> None:
        """Update specific config fields and save."""
        config = await self.load()

        for key, value in updates.items():
            if hasattr(config, key):
                setattr(config, key, value)

        await self.save(config)


# Global instance
_config_parser: Optional[ConfigParser] = None


def init_config_parser(config_path: str = "config.yaml") -> ConfigParser:
    """Initialize global config parser."""
    global _config_parser
    _config_parser = ConfigParser(config_path)
    return _config_parser


def get_config_parser() -> ConfigParser:
    """Get global config parser instance."""
    if _config_parser is None:
        raise RuntimeError("ConfigParser not initialized")
    return _config_parser
