import { useSearchHistory } from "./searchHistory";
import { useGetUrlVisits } from "./getUrlVisits";

export function useRegisterHistoryActions() {
    useSearchHistory();
    useGetUrlVisits();
}

