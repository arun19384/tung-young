package httpadapter

import (
	"context"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

type mrtFareClient struct {
	http  *http.Client
	cache sync.Map
}

var (
	metaRefreshPattern = regexp.MustCompile(`(?i)URL=([^'" >]+)`)
	htmlTagPattern     = regexp.MustCompile(`<[^>]+>`)
	spacePattern       = regexp.MustCompile(`\s+`)
	adultFarePattern   = regexp.MustCompile(`บัตรโดยสาร \(บาท\).*?บุคคลทั่วไป\s+(\d+)`)
)

func newMRTFareClient() *mrtFareClient {
	return &mrtFareClient{http: &http.Client{Timeout: 8 * time.Second}}
}

func (c *mrtFareClient) Fare(ctx context.Context, from, to string) (int, error) {
	fromValue, err := mrtStationValue(from)
	if err != nil {
		return 0, err
	}
	toValue, err := mrtStationValue(to)
	if err != nil {
		return 0, err
	}
	cacheKey := from + ":" + to
	if value, ok := c.cache.Load(cacheKey); ok {
		return value.(int), nil
	}
	query := url.Values{
		"s1": {fromValue}, "s2": {toValue}, "t": {"3"},
		"d": {time.Now().Format("02-01-2006")}, "h": {"12"}, "m": {"00"}, "b": {"1"},
	}
	submitURL := "https://metro.bemplc.co.th/Fare-Calculation-Submit.aspx?" + query.Encode()
	body, err := c.get(ctx, submitURL)
	if err != nil {
		return 0, err
	}
	match := metaRefreshPattern.FindStringSubmatch(body)
	if len(match) != 2 {
		return 0, errors.New("BEM fare result link missing")
	}
	resultURL, err := url.Parse("https://metro.bemplc.co.th/" + html.UnescapeString(match[1]))
	if err != nil {
		return 0, err
	}
	result, err := c.get(ctx, resultURL.String())
	if err != nil {
		return 0, err
	}
	fare, err := parseMRTFare(result)
	if err != nil {
		return 0, err
	}
	c.cache.Store(cacheKey, fare)
	c.cache.Store(to+":"+from, fare)
	return fare, nil
}

func (c *mrtFareClient) get(ctx context.Context, address string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "TungYoung/1.0 fare lookup")
	response, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fare provider returned %d", response.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	return string(data), err
}

func parseMRTFare(document string) (int, error) {
	plain := html.UnescapeString(htmlTagPattern.ReplaceAllString(document, " "))
	plain = spacePattern.ReplaceAllString(plain, " ")
	match := adultFarePattern.FindStringSubmatch(plain)
	if len(match) != 2 {
		return 0, errors.New("adult MRT fare missing")
	}
	fare, err := strconv.Atoi(match[1])
	if err != nil || fare < 16 || fare > 70 {
		return 0, errors.New("invalid MRT fare")
	}
	return fare, nil
}

func mrtStationValue(code string) (string, error) {
	if len(code) != 4 {
		return "", errors.New("invalid MRT station")
	}
	number, err := strconv.Atoi(code[2:])
	if err != nil {
		return "", errors.New("invalid MRT station")
	}
	prefix := strings.ToUpper(code[:2])
	index := number
	if prefix == "PP" {
		index += 42
	}
	if (prefix != "BL" && prefix != "PP") || number < 1 || (prefix == "BL" && number > 38) || (prefix == "PP" && number > 16) {
		return "", errors.New("invalid MRT station")
	}
	return fmt.Sprintf("%s|%d", prefix+code[2:], index), nil
}
