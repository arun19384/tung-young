package outbound

import "github.com/arun19384/tung-young/backend/internal/domain"

type TransitRepository interface{ Lines() []domain.Line }
